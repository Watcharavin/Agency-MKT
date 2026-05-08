import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, campaigns, generatedAssets } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const rows = await db.select().from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.brandId, brandRows[0].id))).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const assets = await db.select().from(generatedAssets)
    .where(eq(generatedAssets.campaignId, id));

  return NextResponse.json({ campaign: rows[0], assets });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.brandId, brandRows[0].id)));
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

  // Build update object from allowed fields
  const ALLOWED = [
    "topic", "brief", "audience", "tone", "language",
    "slideCount", "imageRatio", "pillar", "goal", "cta",
    "captionLength", "footerStyle", "channel", "productId", "status",
    "scheduledAt",
  ] as const;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ALLOWED) {
    if (key in body) {
      // Convert scheduledAt string to Date
      if (key === "scheduledAt" && body[key]) {
        updates[key] = new Date(body[key]);
      } else {
        updates[key] = body[key];
      }
    }
  }

  await db.update(campaigns)
    .set(updates)
    .where(and(eq(campaigns.id, id), eq(campaigns.brandId, brandRows[0].id)));

  return NextResponse.json({ ok: true });
}
