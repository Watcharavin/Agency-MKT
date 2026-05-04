import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brand = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brand.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const body = await req.json();
  const { name, sku, price, description, category, tags, photoUrls } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const [product] = await db.insert(products).values({
    brandId: brand[0].id,
    name,
    sku: sku || null,
    price: price ? Math.round(Number(price) * 100) : null, // เก็บเป็นสตางค์
    description: description || null,
    category: category || null,
    tags: tags ?? [],
    photoUrls: photoUrls ?? [],
  }).returning({ id: products.id });

  return NextResponse.json({ ok: true, id: product.id });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brand = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brand.length === 0) return NextResponse.json([]);

  const rows = await db.select().from(products).where(eq(products.brandId, brand[0].id));
  return NextResponse.json(rows);
}
