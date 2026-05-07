import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, campaigns } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brand = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brand.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const body = await req.json();
  const { channel, topic, productId, brief, audience, tone, language, slideCount, imageRatio, pillar, goal, cta, captionLength, footerStyle } = body;

  if (!channel || !topic) return NextResponse.json({ error: "channel and topic required" }, { status: 400 });

  const [campaign] = await db
    .insert(campaigns)
    .values({
      brandId:       brand[0].id,
      channel,
      topic,
      productId:     productId     ?? null,
      brief:         brief         ?? null,
      audience:      audience      ?? null,
      tone:          tone          ?? "Educational",
      language:      language      ?? "TH",
      slideCount:    slideCount    ?? 3,
      imageRatio:    imageRatio    ?? "1:1",
      pillar:        pillar        ?? null,
      goal:          goal          ?? null,
      cta:           cta           ?? null,
      captionLength: captionLength ?? "Medium",
      footerStyle:   footerStyle   ?? "Full",
      status:        "draft",
    })
    .returning({ id: campaigns.id });

  return NextResponse.json({ ok: true, id: campaign.id });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brand = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brand.length === 0) return NextResponse.json([]);

  const list = await db.select().from(campaigns).where(eq(campaigns.brandId, brand[0].id));
  return NextResponse.json(list);
}
