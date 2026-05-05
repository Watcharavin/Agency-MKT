import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  await db.delete(products).where(and(eq(products.id, id), eq(products.brandId, brandRows[0].id)));
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const priceRaw = body.price;
  const updated = await db
    .update(products)
    .set({
      name:        body.name,
      sku:         body.sku ?? null,
      price:       priceRaw != null ? Math.round(parseFloat(priceRaw) * 100) : null,
      description: body.description ?? null,
      category:    body.category ?? null,
      tags:        body.tags ?? [],
      photoUrls:   body.photoUrls ?? [],
    })
    .where(and(eq(products.id, id), eq(products.brandId, brandRows[0].id)))
    .returning();

  if (updated.length === 0) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  return NextResponse.json({ ok: true, product: updated[0] });
}
