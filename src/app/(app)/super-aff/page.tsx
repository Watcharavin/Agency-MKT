import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, voucherCollections, coupons } from "@/db/schema";
import { eq } from "drizzle-orm";

function fmtDate(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "draft").toLowerCase();
  const styles: Record<string, string> = {
    ready: "border-green-400 text-green-600",
    sent: "border-rose-400 text-rose-500",
    active: "border-green-400 text-green-600",
    draft: "border-zinc-300 text-zinc-400",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${styles[s] ?? styles.draft}`}>
      {s}
    </span>
  );
}

const STRIPE = "repeating-linear-gradient(135deg, #e8e4da, #e8e4da 10px, #ede9e0 10px, #ede9e0 20px)";
const SALMON = "linear-gradient(135deg, #fce8e4 0%, #f8d8d2 100%)";
const SALMON_LIGHT = "linear-gradient(135deg, #fdf2f0 0%, #fae6e1 100%)";

export default async function SuperAffPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  const brand = brandRows[0] ?? null;

  const vouchers = brand
    ? await db.select().from(voucherCollections).where(eq(voucherCollections.brandId, brand.id))
    : [];

  // Fetch first coupon per voucher for thumbnail preview
  const couponDataMap: Record<string, { count: number; firstImageUrl: string | null }> = {};
  for (const v of vouchers) {
    const rows = await db.select().from(coupons).where(eq(coupons.collectionId, v.id)).orderBy(coupons.sortOrder);
    couponDataMap[v.id] = {
      count: rows.length,
      firstImageUrl: rows[0]?.imageUrl ?? null,
    };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Distribution</p>
          <h1 className="text-xl font-semibold text-foreground mt-0.5">Super Affiliate</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{vouchers.length} voucher collection</p>
        </div>
        <Link
          href="/super-aff/new"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity"
        >
          + Create Voucher
        </Link>
      </div>

      {vouchers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-2xl mb-3">📦</p>
          <p className="text-sm text-foreground font-medium">ยังไม่มี Voucher Collection</p>
          <p className="text-xs text-muted-foreground mt-1">สร้าง voucher พร้อม coupon แล้วส่งให้ Affiliate แชร์</p>
          <Link href="/super-aff/new" className="mt-5 inline-block rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
            + Create Voucher แรก
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {vouchers.map((v) => {
            const { count, firstImageUrl } = couponDataMap[v.id] ?? { count: 0, firstImageUrl: null };
            const from = fmtDate(v.validFrom);
            const until = fmtDate(v.validUntil);
            const dateStr = from && until ? `${from} — ${until}` : from ? `From ${from}` : null;

            return (
              <div key={v.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">

                {/* ── Image grid (clickable) ─────────────────── */}
                <Link href={`/super-aff/${v.id}/view`} className="block group">
                  {/* Top row: VOUCHER | COLLECTION — square cells = 1:1 image fits perfectly */}
                  <div className="grid grid-cols-2">
                    <div className="aspect-square overflow-hidden border-r border-border/60">
                      {v.coverImageUrl
                        ? <img src={v.coverImageUrl} alt="cover" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center" style={{ background: SALMON }}>
                            <span className="text-[9px] font-mono tracking-widest" style={{ color: "#c4614e" }}>VOUCHER</span>
                          </div>
                      }
                    </div>
                    <div className="aspect-square overflow-hidden">
                      {v.mergedImageUrl
                        ? <img src={v.mergedImageUrl} alt="collection" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center" style={{ background: SALMON_LIGHT }}>
                            <span className="text-[9px] font-mono tracking-widest" style={{ color: "#d4917e" }}>COLLECTION</span>
                          </div>
                      }
                    </div>
                  </div>

                  {/* Bottom row: coupon 1 | count */}
                  <div className="grid grid-cols-2 border-t border-border/60">
                    <div className="aspect-square overflow-hidden border-r border-border/60 relative">
                      {firstImageUrl
                        ? <img src={firstImageUrl} alt="c1" className="w-full h-full object-cover" />
                        : <div className="w-full h-full" style={{ background: STRIPE }}>
                            <span className="absolute top-2 left-2 text-[9px] font-mono text-zinc-400">c1</span>
                          </div>
                      }
                    </div>
                    <div className="aspect-square flex flex-col items-center justify-between p-3" style={{ background: STRIPE }}>
                      <span className="text-xs font-mono text-zinc-400">+</span>
                      <span className="text-2xl font-bold font-mono" style={{ color: "rgba(150,150,150,0.4)" }}>{count}</span>
                    </div>
                  </div>
                </Link>

                {/* ── Info section ──────────────────────────── */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold text-foreground leading-tight">{v.name}</p>
                    <StatusBadge status={v.status ?? "draft"} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {count} coupon{count !== 1 ? "s" : ""}
                    {dateStr ? ` · ${dateStr}` : ""}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/super-aff/${v.id}/view`}
                      className="rounded-md border border-border px-4 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                    >
                      View
                    </Link>
                    <Link
                      href={`/super-aff/${v.id}`}
                      className="rounded-md border border-border px-4 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/vouchers/new?voucherId=${v.id}`}
                      className="rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-card hover:opacity-80 transition-opacity"
                    >
                      Send →
                    </Link>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
