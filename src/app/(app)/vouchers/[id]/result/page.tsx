import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { brands, voucherCollections, coupons } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { DownloadButton } from "@/components/shared/DownloadButton";

export default async function VoucherResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/vouchers/new" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Generate อีกรอบ
        </Link>
        <div className="flex items-start justify-between mt-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Result · Super AFF</p>
            <h1 className="text-xl font-semibold text-foreground mt-0.5">{voucher.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {couponList.length} coupons · 1080×1080 · 1:1
            </p>
          </div>
          <Link
            href={`/super-aff/${voucher.id}`}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            แก้ไข Voucher
          </Link>
        </div>
      </div>

      {/* Main cards: Cover + Collection */}
      <div className="grid grid-cols-2 gap-5">
        <ImageCard
          label="VOUCHER COVER"
          sub={voucher.name}
          badge="01"
          desc="Hero artwork — represents the whole bundle"
          imageUrl={voucher.coverImageUrl ?? null}
          filename={`${voucher.name}-cover.jpg`}
        />
        <ImageCard
          label="COLLECTION"
          sub="(merged)"
          badge="02"
          desc={`All ${couponList.length} coupons composited into one image`}
          imageUrl={voucher.mergedImageUrl ?? null}
          filename={`${voucher.name}-collection.jpg`}
        />
      </div>

      {/* Coupons grid */}
      {couponList.length > 0 && (
        <div>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Coupons ({couponList.length})
            </h2>
            <span className="text-xs text-muted-foreground">one image per coupon · unlimited</span>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {couponList.map((c, i) => (
              <CouponCard
                key={c.id}
                index={i + 1}
                name={c.name}
                discount={c.discount ?? ""}
                imageUrl={c.imageUrl ?? null}
                filename={`coupon-${i + 1}-${c.name}.jpg`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="rounded-lg border border-border bg-card p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Generate เสร็จแล้ว</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            รูปที่มีสีชมพู = ยังไม่มีรูปจาก AI · รูปที่มีรูปจริง = สำเร็จ
          </p>
        </div>
        <Link
          href="/vouchers/new"
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity"
        >
          ▶ Generate อีกรอบ
        </Link>
      </div>
    </div>
  );
}

// ── Image Card (large) ──────────────────────────────────────────────────────

function ImageCard({
  label,
  sub,
  badge,
  desc,
  imageUrl,
  filename,
}: {
  label: string;
  sub: string;
  badge: string;
  desc: string;
  imageUrl: string | null;
  filename: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-xl overflow-hidden aspect-square group">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
            {/* Download overlay on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <DownloadButton imageUrl={imageUrl} filename={filename} />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-between p-8"
            style={{ background: "linear-gradient(135deg, #f5c8c0 0%, #edb5ab 100%)" }}
          >
            <p className="text-sm font-mono font-bold tracking-[0.25em] uppercase" style={{ color: "#c4614e" }}>
              {label}
            </p>
            <p className="text-lg font-mono font-bold tracking-wider text-center" style={{ color: "#c4614e" }}>
              {sub}
            </p>
            <p className="text-xs font-mono" style={{ color: "#c4614e99" }}>
              1080 × 1080 · 1:1
            </p>
          </div>
        )}
        {/* Badge */}
        <span className="absolute bottom-3 right-3 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-medium"
          style={{ borderColor: "#c4614e66", color: "#c4614e", background: "rgba(245,200,192,0.6)" }}
        >
          {badge}
        </span>
      </div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{label === "VOUCHER COVER" ? "Voucher cover" : "Collection"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        {imageUrl && <DownloadButton imageUrl={imageUrl} filename={filename} variant="text" />}
      </div>
    </div>
  );
}

// ── Coupon Card (small) ─────────────────────────────────────────────────────

function CouponCard({
  index,
  name,
  discount,
  imageUrl,
  filename,
}: {
  index: number;
  name: string;
  discount: string;
  imageUrl: string | null;
  filename: string;
}) {
  const num = String(index).padStart(2, "0");
  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="aspect-square relative group"
        style={{ background: imageUrl ? undefined : "linear-gradient(135deg, #f5c8c0 0%, #edb5ab 100%)" }}
      >
        {imageUrl ? (
          <>
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <DownloadButton imageUrl={imageUrl} filename={filename} size="sm" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-between p-3">
            <p className="text-[9px] font-mono font-bold tracking-[0.2em] uppercase" style={{ color: "#c4614e" }}>
              COUPON {num}
            </p>
            <p className="text-lg font-mono font-black text-center leading-none" style={{ color: "#c4614e" }}>
              {discount || name}
            </p>
            <p className="text-[8px] font-mono" style={{ color: "#c4614e99" }}>1080 × 1080</p>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 text-[10px] text-muted-foreground truncate">{name}</div>
    </div>
  );
}
