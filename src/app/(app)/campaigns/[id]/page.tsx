import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { brands, campaigns, generatedAssets, products, postLogs, socialAccounts } from "@/db/schema";
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

  // Fetch linked product name if any
  let productName: string | null = null;
  if (campaign.productId) {
    const pRows = await db.select({ name: products.name }).from(products).where(eq(products.id, campaign.productId)).limit(1);
    productName = pRows[0]?.name ?? null;
  }

  // Fetch post logs
  const logs = await db.select({
    id: postLogs.id,
    platform: postLogs.platform,
    status: postLogs.status,
    platformPostUrl: postLogs.platformPostUrl,
    errorMessage: postLogs.errorMessage,
    postedAt: postLogs.postedAt,
    accountName: socialAccounts.platformAccountName,
  }).from(postLogs)
    .leftJoin(socialAccounts, eq(postLogs.socialAccountId, socialAccounts.id))
    .where(eq(postLogs.campaignId, id));

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
              {campaign.slideCount} slides · {campaign.imageRatio ?? "1:1"} · {campaign.language} · {campaign.tone}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-mono ${STATUS_STYLE[campaign.status ?? "draft"]}`}>
            {campaign.status ?? "draft"}
          </span>
        </div>
      </div>

      {/* Main content (generate + results) */}
      <CampaignDetailClient campaign={campaign} initialAssets={assets} />

      {/* Post logs */}
      {logs.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground pb-3 border-b border-border">Autopost Results</h2>
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${log.status === "success" ? "bg-green-500" : log.status === "failed" ? "bg-red-500" : "bg-yellow-500"}`} />
                <span className="text-foreground font-medium capitalize">{log.platform}</span>
                {log.accountName && <span className="text-muted-foreground">({log.accountName})</span>}
              </div>
              <div className="flex items-center gap-2">
                {log.status === "success" && log.platformPostUrl && (
                  <a href={log.platformPostUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                    View Post
                  </a>
                )}
                {log.status === "failed" && (
                  <span className="text-red-500" title={log.errorMessage || ""}>Failed</span>
                )}
                {log.postedAt && (
                  <span className="text-muted-foreground">
                    {new Date(log.postedAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign info */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground pb-3 border-b border-border">รายละเอียด</h2>
        <Row label="Channel" value={campaign.channel} />
        {productName && <Row label="สินค้า" value={productName} />}
        {campaign.pillar && <Row label="Content Pillar" value={campaign.pillar} />}
        {campaign.goal && <Row label="เป้าหมาย" value={campaign.goal} />}
        <Row label="Slides" value={`${campaign.slideCount} สไลด์ · ${campaign.imageRatio ?? "1:1"}`} />
        <Row label="Tone" value={campaign.tone ?? "—"} />
        {campaign.audience && <Row label="กลุ่มเป้าหมาย" value={campaign.audience} />}
        <Row label="ภาษา" value={campaign.language ?? "—"} />
        <Row label="Caption" value={campaign.captionLength ?? "Medium"} />
        <Row label="Footer" value={campaign.footerStyle ?? "Full"} />
        {campaign.cta && <Row label="CTA" value={campaign.cta} />}
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
