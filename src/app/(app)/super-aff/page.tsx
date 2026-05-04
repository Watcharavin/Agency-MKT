import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { DeleteVoucherButton } from "@/components/shared/DeleteVoucherButton";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, voucherCollections, coupons } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function SuperAffPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  const brand = brandRows[0] ?? null;

  const vouchers = brand
    ? await db.select().from(voucherCollections).where(eq(voucherCollections.brandId, brand.id))
    : [];

  const couponCountMap: Record<string, number> = {};
  for (const v of vouchers) {
    const rows = await db.select().from(coupons).where(eq(coupons.collectionId, v.id));
    couponCountMap[v.id] = rows.length;
  }

  return (
    <div className="space-y-6">
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
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-2xl mb-3">📦</p>
          <p className="text-sm text-foreground font-medium">ยังไม่มี Voucher Collection</p>
          <p className="text-xs text-muted-foreground mt-1">
            สร้าง voucher พร้อม coupon แล้วส่งให้ Affiliate แชร์
          </p>
          <Link
            href="/super-aff/new"
            className="mt-5 inline-block rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            + Create Voucher แรก
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {vouchers.map((v) => (
            <div key={v.id} className="rounded-lg border border-border bg-card overflow-hidden">
              {/* Cover image */}
              <div className="h-36 w-full relative overflow-hidden">
                {v.coverImageUrl ? (
                  <img src={v.coverImageUrl} alt={v.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ background: "repeating-linear-gradient(45deg, #e8e3d8, #e8e3d8 12px, #f0ece4 12px, #f0ece4 24px)" }} />
                )}
                <span className="absolute top-2 right-2 rounded-full bg-card/80 px-2 py-0.5 text-[10px] font-mono text-foreground">
                  {v.status ?? "draft"}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{v.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {couponCountMap[v.id] ?? 0} coupon{(couponCountMap[v.id] ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/vouchers/new?voucherId=${v.id}`}
                    className="flex-1 rounded-md bg-foreground py-1.5 text-center text-xs font-medium text-card hover:opacity-80 transition-opacity"
                  >
                    Generate
                  </Link>
                  <Link
                    href={`/super-aff/${v.id}`}
                    className="flex-1 rounded-md border border-border py-1.5 text-center text-xs text-foreground hover:bg-secondary transition-colors"
                  >
                    Edit
                  </Link>
                </div>
                <DeleteVoucherButton id={v.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
