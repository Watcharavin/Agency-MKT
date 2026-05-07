import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const k1 = process.env.OPENROUTER_API_KEY;
  const k2 = process.env.OR_KEY;
  return NextResponse.json({
    OPENROUTER_API_KEY: !!k1,
    OR_KEY: !!k2,
    prefix: (k1 ?? k2)?.slice(0, 12) ?? null,
  });
}

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

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OR_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not set" }, { status: 500 });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4-5",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[suggest-topic] OpenRouter error:", res.status, errText);
      return NextResponse.json({ error: "AI generation failed", detail: errText }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const topics = text
      .split("\n")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0)
      .slice(0, 4);

    return NextResponse.json({ topics });
  } catch (err) {
    console.error("[suggest-topic] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "AI generation failed", detail: msg }, { status: 500 });
  }
}
