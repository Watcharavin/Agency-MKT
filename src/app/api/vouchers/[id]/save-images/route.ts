import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, voucherCollections, coupons } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type SavedImage = {
  label: string;       // "voucher_cover" | "coupon"
  couponId?: string;
  imageUrl: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const images: SavedImage[] = body.images ?? [];

  // Verify brand ownership
  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const voucherRows = await db
    .select({ id: voucherCollections.id })
    .from(voucherCollections)
    .where(and(eq(voucherCollections.id, id), eq(voucherCollections.brandId, brandRows[0].id)))
    .limit(1);

  if (voucherRows.length === 0) return NextResponse.json({ error: "Voucher not found" }, { status: 404 });

  // Save each image
  for (const img of images) {
    if (img.label === "voucher_cover") {
      await db
        .update(voucherCollections)
        .set({ coverImageUrl: img.imageUrl })
        .where(eq(voucherCollections.id, id));
    } else if (img.label === "collection") {
      await db
        .update(voucherCollections)
        .set({ mergedImageUrl: img.imageUrl })
        .where(eq(voucherCollections.id, id));
    } else if (img.label === "coupon" && img.couponId) {
      await db
        .update(coupons)
        .set({ imageUrl: img.imageUrl })
        .where(and(eq(coupons.id, img.couponId), eq(coupons.collectionId, id)));
    }
  }

  return NextResponse.json({ ok: true, saved: images.length });
}
