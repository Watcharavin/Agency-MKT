import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // ── Platform (coming soon) ─────────────────────────────────────────────
  void type; // reserved for future platform-specific logic
  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← กลับ Campaigns
        </Link>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-3">Create</p>
        <h1 className="text-xl font-semibold text-foreground mt-0.5">New Campaign — Platform</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          สร้าง Content AI สำหรับโพสต์ลง Facebook · Instagram · LINE · TikTok
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-2xl mb-3">◑</p>
        <p className="text-sm text-foreground font-medium">Coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">Platform Campaign กำลังพัฒนาอยู่</p>
      </div>
    </div>
  );
}
