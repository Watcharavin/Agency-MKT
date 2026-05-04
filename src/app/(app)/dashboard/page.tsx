import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { eq } from "drizzle-orm";

const QUICK_ACTIONS = [
  { href: "/campaigns/new", icon: "✦", label: "สร้าง Campaign ใหม่", desc: "Facebook · Instagram · LINE · TikTok" },
  { href: "/brand",         icon: "◈", label: "แก้ไข Brand DNA",     desc: "โทน สี กลุ่มเป้าหมาย" },
  { href: "/products/new",  icon: "◧", label: "เพิ่มสินค้า",         desc: "อัปโหลดรูป + ข้อมูลสินค้า" },
];

const STATS = [
  { label: "Campaigns", value: "0", sub: "สร้างแล้ว" },
  { label: "Images",    value: "0", sub: "AI สร้างให้" },
  { label: "Products",  value: "0", sub: "ในระบบ" },
];

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const brand = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.userId, userId))
    .limit(1);

  if (brand.length === 0) redirect("/onboarding");

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">ยินดีต้อนรับกลับมา — เริ่มสร้าง Content กันเลย</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{s.label}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">เริ่มต้น</p>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className={`group rounded-lg border p-5 transition-colors ${
                i === 0
                  ? "border-foreground bg-foreground text-card hover:opacity-90"
                  : "border-border bg-card hover:bg-secondary"
              }`}
            >
              <span className="text-xl">{a.icon}</span>
              <p className={`mt-3 font-medium text-sm ${i === 0 ? "text-card" : "text-foreground"}`}>{a.label}</p>
              <p className={`text-xs mt-0.5 ${i === 0 ? "text-card/60" : "text-muted-foreground"}`}>{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent campaigns */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">Campaigns ล่าสุด</p>
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground text-sm">ยังไม่มี campaign — กด "สร้าง Campaign ใหม่" เพื่อเริ่ม</p>
        </div>
      </div>
    </div>
  );
}
