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

function buildFooter(socialLinks: SocialLinks | null, footerStyle: string | null, brandName: string | null): string {
  if (!footerStyle || footerStyle === "ไม่ใส่") return "";
  const links = socialLinks ?? {};
  const lines: string[] = [];

  if (footerStyle === "Full") {
    if (links.facebook)  lines.push(`Facebook: ${links.facebook}`);
    if (links.instagram) lines.push(`Instagram: ${links.instagram}`);
    if (links.tiktok)    lines.push(`TikTok: ${links.tiktok}`);
    if (links.line)      lines.push(`LINE: ${links.line}`);
    if (links.lineUrl)   lines.push(`LINE: ${links.lineUrl}`);
    if (links.shopee)    lines.push(`Shopee: ${links.shopee}`);
    if (links.tiktokShop) lines.push(`TikTok Shop: ${links.tiktokShop}`);
    if (links.phone)     lines.push(`Tel: ${links.phone}`);
  } else if (footerStyle === "Shopee") {
    if (links.shopee)    lines.push(`Shopee: ${links.shopee}`);
    if (links.tiktokShop) lines.push(`TikTok Shop: ${links.tiktokShop}`);
    if (links.phone)     lines.push(`Tel: ${links.phone}`);
  } else if (footerStyle === "LINE") {
    if (links.line)      lines.push(`LINE: ${links.line}`);
    if (links.lineUrl)   lines.push(`LINE: ${links.lineUrl}`);
    if (links.phone)     lines.push(`Tel: ${links.phone}`);
  } else if (footerStyle === "Min") {
    if (brandName) lines.push(`by ${brandName}`);
    if (links.phone) lines.push(`Tel: ${links.phone}`);
  }

  return lines.length > 0 ? "\n---\n" + lines.join("\n") : "";
}

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

  // Build footer from social links
  const footer = buildFooter(
    brand.socialLinks as SocialLinks | null,
    campaign.footerStyle,
    brand.name,
  );

  // Build AI prompt for caption + hashtags
  const brandContext = [
    `Brand: ${brand.name}`,
    brand.tagline ? `Tagline: "${brand.tagline}"` : "",
    brand.about ? `About: ${brand.about}` : "",
    brand.audience ? `Target audience: ${brand.audience}` : "",
  ].filter(Boolean).join("\n");

  const captionLenGuide: Record<string, string> = {
    Short: "2-3 ประโยค สั้นกระชับ",
    Medium: "4-6 ประโยค อธิบายพอดี",
    Long: "7-10 ประโยค ลงรายละเอียด",
  };
  const lenGuide = captionLenGuide[campaign.captionLength ?? "Medium"] ?? captionLenGuide.Medium;

  const prompt = `You are a Thai social media content writer.

${brandContext}
Platform: ${campaign.channel}
Topic: ${campaign.topic}
${campaign.pillar ? `Content Pillar: ${campaign.pillar}` : ""}
${campaign.goal ? `Goal: ${campaign.goal}` : ""}
Tone: ${campaign.tone ?? "Educational"}
${campaign.audience ? `Audience: ${campaign.audience}` : ""}
${productName ? `Product: ${productName}${productDesc ? ` — ${productDesc}` : ""}` : ""}
${campaign.cta ? `CTA: ${campaign.cta}` : ""}
Language: ${campaign.language ?? "TH"}

Write a social media caption for this post.
- Length: ${lenGuide}
- Match the tone and brand voice
- Include a compelling hook in the first line
- ${campaign.cta ? `End with CTA: "${campaign.cta}"` : "End with a clear call-to-action"}
- Write in ${campaign.language === "EN" ? "English" : "Thai"}

Then generate 5-8 relevant hashtags.

Return in this EXACT format (no extra text):
CAPTION:
[your caption here]

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
        max_tokens: 800,
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

    let caption = captionMatch?.[1]?.trim() ?? text.trim();
    let hashtags = hashtagsMatch?.[1]?.trim() ?? "";

    // Append footer to caption
    if (footer) {
      caption = caption + "\n" + footer;
    }

    return NextResponse.json({ caption, hashtags, footer });
  } catch (err) {
    console.error("[generate/text] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "AI generation failed", detail: msg }, { status: 500 });
  }
}
