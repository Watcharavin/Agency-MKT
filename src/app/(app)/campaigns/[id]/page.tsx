import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { brands, campaigns } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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

  return (
    <div className="space-y-6">
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
          <span className="rounded-full border border-border px-3 py-1 text-[11px] font-mono text-muted-foreground">
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Placeholder output area */}
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-2xl mb-3">◑</p>
        <p className="text-sm text-foreground font-medium">รอ Generate</p>
        <p className="text-xs text-muted-foreground mt-1 mb-5">
          กด Generate เพื่อให้ AI สร้างรูป + caption + hashtags
        </p>
        <button className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity">
          ▶ Generate Content
        </button>
      </div>

      {/* Campaign info */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground pb-3 border-b border-border">รายละเอียด</h2>
        <Row label="Channel" value={campaign.channel} />
        <Row label="Slides" value={`${campaign.slideCount} สไลด์`} />
        <Row label="Tone" value={campaign.tone ?? "—"} />
        <Row label="ภาษา" value={campaign.language ?? "—"} />
        {campaign.brief && <Row label="Brief" value={campaign.brief} />}
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
