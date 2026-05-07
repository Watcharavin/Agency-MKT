import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  const brand = brandRows[0] ?? null;

  const body = await req.json();
  const { platform, pillar, goal, productId } = body;

  let productName = "";
  let productDesc = "";
  if (productId) {
    const pRows = await db.select({ name: products.name, description: products.description })
      .from(products).where(eq(products.id, productId)).limit(1);
    if (pRows[0]) {
      productName = pRows[0].name;
      productDesc = pRows[0].description ?? "";
    }
  }

  const brandContext = brand
    ? `Brand: ${brand.name}${brand.tagline ? ` — ${brand.tagline}` : ""}${brand.about ? `\nAbout: ${brand.about}` : ""}`
    : "";

  const prompt = `You are a Thai social media content strategist.
${brandContext}
Platform: ${platform}
Content Pillar: ${pillar || "General"}
Goal: ${goal || "Awareness"}
${productName ? `Product: ${productName}${productDesc ? ` — ${productDesc}` : ""}` : ""}

Generate exactly 4 engaging post topic ideas in Thai for this brand.
- Each topic should be a catchy, specific hook sentence (not a vague title)
- Suitable for ${platform} ${pillar} content with ${goal} goal
- Write in Thai, keep each under 80 characters
- Return only the 4 topics, one per line, no numbering, no extra text`;

  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

  try {
    const { text } = await generateText({
      model: openrouter("anthropic/claude-haiku-4.5"),
      prompt,
      maxTokens: 300,
    });

    const topics = text
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 4);

    return NextResponse.json({ topics });
  } catch (err) {
    console.error("[suggest-topic] AI error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "AI generation failed", detail: msg }, { status: 500 });
  }
}
