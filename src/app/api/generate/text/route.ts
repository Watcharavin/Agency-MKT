import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, campaigns, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type SocialLinks = {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  tiktokShop?: string;
  line?: string;
  lineUrl?: string;
  shopee?: string;
  phone?: string;
};

function buildBrandSignature(brandName: string | null, tagline: string | null): string {
  if (!brandName) return "";
  const lines: string[] = [];
  lines.push(`✨ ${brandName} ✨`);
  if (tagline) lines.push(tagline);
  return lines.join("\n");
}

function buildShopLinks(socialLinks: SocialLinks | null, footerStyle: string | null): string {
  if (!footerStyle || footerStyle === "ไม่ใส่") return "";
  const links = socialLinks ?? {};
  const lines: string[] = [];

  // Shop links section (Shopee, TikTok Shop)
  if (footerStyle === "Full" || footerStyle === "Shopee") {
    const shopLines: string[] = [];
    if (links.shopee) shopLines.push(`Shopee: ${links.shopee}`);
    if (links.tiktokShop) shopLines.push(`Tiktok Shop: ${links.tiktokShop}`);
    if (shopLines.length > 0) {
      lines.push("📲ช๊อปเลย!");
      lines.push(...shopLines);
    }
  } else if (footerStyle === "LINE") {
    if (links.line || links.lineUrl) {
      lines.push("📲สั่งซื้อเลย!");
      if (links.line) lines.push(`LINE: ${links.line}`);
      if (links.lineUrl) lines.push(`  หรือคลิ้ก ${links.lineUrl}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

function buildFooter(socialLinks: SocialLinks | null, footerStyle: string | null): string {
  if (!footerStyle || footerStyle === "ไม่ใส่") return "";
  const links = socialLinks ?? {};

  if (footerStyle === "Min") {
    const minLines: string[] = [];
    if (links.phone) minLines.push(`📞 โทร       : ${links.phone}`);
    return minLines.join("\n");
  }

  // Full footer with all social links
  const lines: string[] = [];
  if (links.facebook)  lines.push(`📘 Facebook  : ${links.facebook}`);
  if (links.line)      lines.push(`💚 Line      : ${links.line}`);
  if (links.lineUrl)   lines.push(`  หรือคลิ้ก ${links.lineUrl}`);
  if (links.instagram) lines.push(`📷 Instagram : ${links.instagram}`);
  if (links.tiktok)    lines.push(`🎵 TikTok    : ${links.tiktok}`);
  if (links.shopee)    lines.push(`🧡 Shopee    : ${links.shopee}`);
  if (links.tiktokShop) lines.push(`🛒 TikTok Shop: ${links.tiktokShop}`);
  if (links.phone)     lines.push(`📞 โทร       : ${links.phone}`);

  if (footerStyle === "Shopee") {
    // Only show shop-related links
    const shopOnly: string[] = [];
    if (links.shopee)    shopOnly.push(`🧡 Shopee    : ${links.shopee}`);
    if (links.tiktokShop) shopOnly.push(`🛒 TikTok Shop: ${links.tiktokShop}`);
    if (links.phone)     shopOnly.push(`📞 โทร       : ${links.phone}`);
    return shopOnly.join("\n");
  }

  if (footerStyle === "LINE") {
    const lineOnly: string[] = [];
    if (links.line)    lineOnly.push(`💚 Line      : ${links.line}`);
    if (links.lineUrl) lineOnly.push(`  หรือคลิ้ก ${links.lineUrl}`);
    if (links.phone)   lineOnly.push(`📞 โทร       : ${links.phone}`);
    return lineOnly.join("\n");
  }

  return lines.join("\n");
}

const DIVIDER = "──────────────────────";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { campaignId } = body;
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  const brand = brandRows[0];

  const campaignRows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.brandId, brand.id)))
    .limit(1);
  if (campaignRows.length === 0) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  const campaign = campaignRows[0];

  // Fetch product info if linked
  let productName = "";
  let productDesc = "";
  if (campaign.productId) {
    const pRows = await db.select({ name: products.name, description: products.description })
      .from(products).where(eq(products.id, campaign.productId)).limit(1);
    if (pRows[0]) {
      productName = pRows[0].name;
      productDesc = pRows[0].description ?? "";
    }
  }

  const socialLinks = brand.socialLinks as SocialLinks | null;

  // Build AI prompt
  const brandContext = [
    `Brand: ${brand.name}`,
    brand.tagline ? `Tagline: "${brand.tagline}"` : "",
    brand.about ? `About: ${brand.about}` : "",
    brand.audience ? `Target audience: ${brand.audience}` : "",
  ].filter(Boolean).join("\n");

  const captionLenGuide: Record<string, string> = {
    Short: "สั้นกระชับ 3-5 บรรทัด",
    Medium: "ปานกลาง 6-12 บรรทัด",
    Long: "ยาวละเอียด 12-20 บรรทัด พร้อม bullet points",
  };
  const lenGuide = captionLenGuide[campaign.captionLength ?? "Medium"] ?? captionLenGuide.Medium;

  const prompt = `You are an expert Thai social media copywriter. Write a ${campaign.channel} post caption.

${brandContext}
Platform: ${campaign.channel}
Topic: ${campaign.topic}
${campaign.pillar ? `Content Pillar: ${campaign.pillar}` : ""}
${campaign.goal ? `Goal: ${campaign.goal}` : ""}
Tone: ${campaign.tone ?? "Educational"}
${campaign.audience ? `Audience: ${campaign.audience}` : ""}
${productName ? `Product: ${productName}${productDesc ? ` — ${productDesc}` : ""}` : ""}
${campaign.cta ? `CTA: ${campaign.cta}` : ""}
Language: ${campaign.language === "EN" ? "English" : "Thai"}

Write the caption following this EXACT structure:

1. HOOK LINE — One catchy headline that grabs attention (can include emoji)
2. OPENING — Emoji + engaging intro sentence that draws reader in
3. PROBLEM/PAIN POINT — Relatable situation the audience faces
4. PRODUCT/SOLUTION INTRO — Introduce with emoji, brand name, product name
5. FEATURE BULLETS — 3-5 features, each with emoji + bold feature name + description
6. VARIANTS/OPTIONS — If product has variants, list them with bullet points (skip if not applicable)
7. CLOSING HOOK — Emotional/aspirational sentence
8. CTA — Clear call-to-action telling user what to do next (comment, message, order)${campaign.cta ? ` Use this CTA: "${campaign.cta}"` : ""}

Guidelines:
- Length: ${lenGuide}
- Use emojis naturally (not excessive)
- Use line breaks for readability
- Feature bullets format: emoji + feature name — description
- Write in ${campaign.language === "EN" ? "English" : "Thai"}
- DO NOT include any footer, social links, hashtags, or brand signature — those are added separately
- DO NOT include divider lines (──) — those are added separately

Then generate 8-12 relevant hashtags in ${campaign.language === "EN" ? "English" : "Thai"} + English mix.

Return in this EXACT format:
CAPTION:
[your caption here — ONLY the caption body, NO footer/links/hashtags]

HASHTAGS:
[#tag1 #tag2 #tag3 ...]`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY not set" }, { status: 500 });

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
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[generate/text] OpenRouter error:", res.status, errText);
      return NextResponse.json({ error: "AI generation failed", detail: errText }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";

    // Parse CAPTION: and HASHTAGS: sections
    const captionMatch = text.match(/CAPTION:\s*\n([\s\S]*?)(?=\nHASHTAGS:|\n*$)/i);
    const hashtagsMatch = text.match(/HASHTAGS:\s*\n([\s\S]*?)$/i);

    let captionBody = captionMatch?.[1]?.trim() ?? text.trim();
    const hashtags = hashtagsMatch?.[1]?.trim() ?? "";

    // Assemble full post: caption + brand signature + shop links + footer
    const parts: string[] = [captionBody];

    // Brand signature
    const signature = buildBrandSignature(brand.name, brand.tagline);
    if (signature && campaign.footerStyle !== "ไม่ใส่") {
      parts.push(signature);
    }

    // Shop links section
    const shopLinks = buildShopLinks(socialLinks, campaign.footerStyle);
    if (shopLinks) {
      parts.push(DIVIDER);
      parts.push(shopLinks);
    }

    // Full social footer
    const footer = buildFooter(socialLinks, campaign.footerStyle);
    if (footer && campaign.footerStyle === "Full") {
      parts.push(DIVIDER);
      parts.push(footer);
    } else if (footer && campaign.footerStyle !== "Full") {
      // For non-Full styles, footer was already specific
      if (!shopLinks) {
        parts.push(DIVIDER);
        parts.push(footer);
      }
    }

    const fullCaption = parts.join("\n");

    return NextResponse.json({ caption: fullCaption, hashtags, footer });
  } catch (err) {
    console.error("[generate/text] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "AI generation failed", detail: msg }, { status: 500 });
  }
}
