import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { brands, campaigns, generatedAssets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { CampaignDetailClient } from "@/components/shared/CampaignDetailClient";

const STATUS_STYLE: Record<string, string> = {
  draft:      "bg-secondary text-muted-foreground",
  generating: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  generated:  "bg-green-50 text-green-700 border border-green-200",
  scheduled:  "bg-blue-50 text-blue-700 border border-blue-200",
  published:  "bg-foreground text-card",
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) redirect("/onboarding");

  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.brandId, brandRows[0].id)))
    .limit(1);

  if (rows.length === 0) notFound();
  const campaign = rows[0];

  const assets = await db.select().from(generatedAssets).where(eq(generatedAssets.campaignId, id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/campaigns" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← กลับ Campaigns
        </Link>
        <div className="flex items-start justify-between mt-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{campaign.channel}</p>
            <h1 className="text-xl font-semibold text-foreground mt-0.5">{campaign.topic}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {campaign.slideCount} slides · {campaign.language} · {campaign.tone}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-mono ${STATUS_STYLE[campaign.status ?? "draft"]}`}>
            {campaign.status ?? "draft"}
          </span>
        </div>
      </div>

      {/* Main content (generate + results) */}
      <CampaignDetailClient campaign={campaign} initialAssets={assets} />

      {/* Campaign info */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground pb-3 border-b border-border">รายละเอียด</h2>
        <Row label="Channel" value={campaign.channel} />
        <Row label="Slides" value={`${campaign.slideCount} สไลด์`} />
        <Row label="Tone" value={campaign.tone ?? "—"} />
        <Row label="ภาษา" value={campaign.language ?? "—"} />
        {campaign.brief && <Row label="Brief" value={campaign.brief} />}
        <Row label="สร้างเมื่อ" value={campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
