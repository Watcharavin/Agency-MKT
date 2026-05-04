import Link from "next/link";

const FILTERS = ["ทั้งหมด", "Facebook", "Instagram", "LINE", "TikTok"];

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Distribution</p>
          <h1 className="text-xl font-semibold text-foreground mt-0.5">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-generated posts สำหรับทุก platform</p>
        </div>
        <Link
          href="/campaigns/new?type=platform"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity"
        >
          ↗ To Platform
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              f === "ทั้งหมด"
                ? "bg-foreground text-card"
                : "bg-secondary text-foreground hover:bg-border"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-2xl mb-3">✦</p>
        <p className="text-sm text-foreground font-medium">ยังไม่มี Campaign</p>
        <p className="text-xs text-muted-foreground mt-1">
          สร้าง Campaign แล้วให้ AI เขียน Caption + สร้างรูปให้ทันที
        </p>
        <Link
          href="/campaigns/new?type=platform"
          className="mt-5 inline-block rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
        >
          สร้าง Campaign แรก
        </Link>
      </div>
    </div>
  );
}
