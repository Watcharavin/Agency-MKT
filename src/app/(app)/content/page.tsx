import Link from "next/link";

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Workspace</p>
          <h1 className="text-xl font-semibold text-foreground mt-0.5">Content Plan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ตารางปฏิทิน Content ที่วางแผนไว้</p>
        </div>
        <Link
          href="/campaigns/new"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity"
        >
          + สร้าง Campaign
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-2xl mb-3">▦</p>
        <p className="text-sm text-foreground font-medium">Content Calendar</p>
        <p className="text-xs text-muted-foreground mt-1">
          สร้าง Campaign แล้ว schedule วันโพสต์ — จะแสดงที่นี่
        </p>
        <Link
          href="/campaigns/new"
          className="mt-5 inline-block rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
        >
          สร้าง Campaign แรก
        </Link>
      </div>
    </div>
  );
}
