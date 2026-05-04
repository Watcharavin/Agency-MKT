import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { brands, voucherCollections, coupons, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { DownloadButton } from "@/components/shared/DownloadButton";

function fmtDate(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "draft").toLowerCase();
  const styles: Record<string, string> = {
    ready: "bg-green-50 border-green-400 text-green-600",
    sent: "bg-rose-50 border-rose-400 text-rose-500",
    active: "bg-green-50 border-green-400 text-green-600",
    draft: "bg-zinc-50 border-zinc-300 text-zinc-400",
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wider uppercase ${styles[s] ?? styles.draft}`}>
      {s}
    </span>
  );
}

const SALMON = "linear-gradient(135deg, #fce8e4 0%, #f8d8d2 100%)";
const STRIPE = "repeating-linear-gradient(135deg, #e8e4da, #e8e4da 10px, #ede9e0 10px, #ede9e0 20px)";

export default async function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) redirect("/onboarding");

  const voucherRows = await db
    .select()
    .from(voucherCollections)
    .where(and(eq(voucherCollections.id, id), eq(voucherCollections.brandId, brandRows[0].id)))
    .limit(1);

  if (voucherRows.length === 0) notFound();
  const voucher = voucherRows[0];

  const couponList = await db
    .select()
    .from(coupons)
    .where(eq(coupons.collectionId, id))
    .orderBy(coupons.sortOrder);

  // Get product names for coupons
  const productIds = couponList.map(c => c.productId).filter((p): p is string => !!p);
  const productMap = new Map<string, string>();
  if (productIds.length > 0) {
    const productRows = await db.select({ id: products.id, name: products.name }).from(products);
    for (const p of productRows) productMap.set(p.id, p.name);
  }

  const from = fmtDate(voucher.validFrom);
  const until = fmtDate(voucher.validUntil);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <Link href="/super-aff" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Super Affiliate
        </Link>
        <div className="flex items-start justify-between mt-3">
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Voucher Detail</p>
            <h1 className="text-2xl font-bold text-foreground">{voucher.name}</h1>
            {voucher.description && <p className="text-sm text-muted-foreground">{voucher.description}</p>}
            <div className="flex items-center gap-3 pt-1">
              <StatusBadge status={voucher.status ?? "draft"} />
              {from && until && (
                <span className="text-xs text-muted-foreground">{from} — {until}</span>
              )}
              <span className="text-xs text-muted-foreground">{couponList.length} coupon{couponList.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/vouchers/new?voucherId=${voucher.id}`}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity"
            >
              ▶ Generate
            </Link>
            <Link
              href={`/super-aff/${voucher.id}`}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Main images: Cover + Collection */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Generated Images</p>
        <div className="grid grid-cols-2 gap-4">
          {/* Cover */}
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden aspect-square">
              {voucher.coverImageUrl ? (
                <>
                  <img src={voucher.coverImageUrl} alt="Voucher Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <DownloadButton imageUrl={voucher.coverImageUrl} filename={`${voucher.name}-cover.jpg`} />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: SALMON }}>
                  <p className="text-xs font-mono font-bold tracking-widest uppercase" style={{ color: "#c4614e" }}>VOUCHER COVER</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Voucher Cover</p>
                <p className="text-xs text-muted-foreground">Hero image · 1080×1080</p>
              </div>
              {voucher.coverImageUrl && <DownloadButton imageUrl={voucher.coverImageUrl} filename={`${voucher.name}-cover.jpg`} variant="text" />}
            </div>
          </div>

          {/* Collection */}
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden aspect-square">
              {voucher.mergedImageUrl ? (
                <>
                  <img src={voucher.mergedImageUrl} alt="Collection" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <DownloadButton imageUrl={voucher.mergedImageUrl} filename={`${voucher.name}-collection.jpg`} />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: SALMON }}>
                  <p className="text-xs font-mono font-bold tracking-widest uppercase" style={{ color: "#c4614e" }}>COLLECTION</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Collection</p>
                <p className="text-xs text-muted-foreground">All coupons merged · 1080×1080</p>
              </div>
              {voucher.mergedImageUrl && <DownloadButton imageUrl={voucher.mergedImageUrl} filename={`${voucher.name}-collection.jpg`} variant="text" />}
            </div>
          </div>
        </div>
      </div>

      {/* Coupons */}
      {couponList.length > 0 && (
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Coupons ({couponList.length})
          </p>
          <div className="grid grid-cols-4 gap-3">
            {couponList.map((c, i) => (
              <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Image */}
                <div className="relative aspect-square group">
                  {c.imageUrl ? (
                    <>
                      <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <DownloadButton imageUrl={c.imageUrl} filename={`coupon-${i + 1}-${c.name}.jpg`} size="sm" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-3" style={{ background: SALMON }}>
                      <p className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: "#c4614e" }}>
                        COUPON {String(i + 1).padStart(2, "0")}
                      </p>
                      <p className="text-base font-black text-center" style={{ color: "#c4614e" }}>
                        {c.discount || c.name}
                      </p>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="p-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                  {c.discount && <p className="text-xs text-muted-foreground">{c.discount}</p>}
                  {c.code && (
                    <p className="text-[10px] font-mono bg-secondary rounded px-1.5 py-0.5 w-fit">{c.code}</p>
                  )}
                  {c.productId && productMap.get(c.productId) && (
                    <p className="text-[10px] text-muted-foreground truncate">📦 {productMap.get(c.productId)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voucher info */}
      {(voucher.caption || voucher.valueCap) && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Details</p>
          {voucher.valueCap && (
            <div>
              <p className="text-xs text-muted-foreground">Value Cap</p>
              <p className="text-sm font-medium text-foreground">{voucher.valueCap}</p>
            </div>
          )}
          {voucher.caption && (
            <div>
              <p className="text-xs text-muted-foreground">Caption</p>
              <p className="text-sm text-foreground">{voucher.caption}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
