import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, voucherCollections, coupons } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brand = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.userId, userId))
    .limit(1);

  if (brand.length === 0) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const brandId = brand[0].id;
  const body = await req.json();
  const {
    name, caption, mergeMode, valueCap, status,
    validFrom, validUntil,
    coupons: couponList,
  } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const [collection] = await db
    .insert(voucherCollections)
    .values({
      brandId,
      name,
      caption: caption || null,
      mergeMode: mergeMode || "auto",
      valueCap: valueCap || null,
      status: status || "draft",
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
    })
    .returning({ id: voucherCollections.id });

  if (Array.isArray(couponList) && couponList.length > 0) {
    await db.insert(coupons).values(
      couponList.map((c: { name: string; productId?: string; code?: string; discount?: string }, idx: number) => ({
        collectionId: collection.id,
        productId: c.productId || null,
        name: c.name,
        code: c.code || null,
        discount: c.discount || null,
        sortOrder: idx,
      }))
    );
  }

  return NextResponse.json({ ok: true, id: collection.id });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brand = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.userId, userId))
    .limit(1);

  if (brand.length === 0) return NextResponse.json([]);

  const collections = await db
    .select()
    .from(voucherCollections)
    .where(eq(voucherCollections.brandId, brand[0].id));

  return NextResponse.json(collections);
}
