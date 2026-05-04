import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, voucherCollections, coupons } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const brand = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brand.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  await db
    .delete(voucherCollections)
    .where(and(eq(voucherCollections.id, id), eq(voucherCollections.brandId, brand[0].id)));

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const brand = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brand.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const body = await req.json();
  const { name, caption, mergeMode, valueCap, status, validFrom, validUntil, coupons: couponList } = body;

  await db
    .update(voucherCollections)
    .set({
      name,
      caption: caption ?? null,
      mergeMode: mergeMode ?? "auto",
      valueCap: valueCap ?? null,
      status: status ?? "draft",
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      updatedAt: new Date(),
    })
    .where(and(eq(voucherCollections.id, id), eq(voucherCollections.brandId, brand[0].id)));

  // ลบ coupons เก่าทั้งหมดแล้วสร้างใหม่
  await db.delete(coupons).where(eq(coupons.collectionId, id));

  if (Array.isArray(couponList) && couponList.length > 0) {
    await db.insert(coupons).values(
      couponList.map((c: { name: string; productId?: string; discount?: string; code?: string }, idx: number) => ({
        collectionId: id,
        productId: c.productId ?? null,
        name: c.name,
        discount: c.discount ?? null,
        code: c.code ?? null,
        sortOrder: idx,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
