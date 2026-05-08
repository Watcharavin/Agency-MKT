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
  let productPrice = 0;
  let productCategory = "";
  let productTags: string[] = [];
  if (campaign.productId) {
    const pRows = await db
      .select({ name: products.name, description: products.description, price: products.price, category: products.category, tags: products.tags })
      .from(products).where(eq(products.id, campaign.productId)).limit(1);
    if (pRows[0]) {
      productName = pRows[0].name;
      productDesc = pRows[0].description ?? "";
      productPrice = pRows[0].price ?? 0;
      productCategory = pRows[0].category ?? "";
      productTags = (pRows[0].tags as string[]) ?? [];
    }
  }

  const socialLinks = brand.socialLinks as SocialLinks | null;

  // ── Build brand context ──
  const brandTones = (brand.toneTags as string[] | null) ?? [];
  const combinedTone = [campaign.tone ?? "Educational", ...brandTones].filter(Boolean);
  const uniqueTones = [...new Set(combinedTone)].join(", ");

  const brandContext = [
    `Brand: ${brand.name}`,
    brand.tagline ? `Tagline: "${brand.tagline}"` : "",
    brand.about ? `About: ${brand.about}` : "",
    brand.audience ? `Target audience: ${brand.audience}` : "",
    brand.primaryColor
      ? `Brand color mood: primary ${brand.primaryColor}${brand.secondaryColor ? `, secondary ${brand.secondaryColor}` : ""}${brand.thirdColor ? `, accent ${brand.thirdColor}` : ""} — let the color palette influence the emotional tone (e.g. deep purple = premium, bright orange = energetic)`
      : "",
  ].filter(Boolean).join("\n");

  const voiceRules = [
    brand.doSay ? `MUST USE these words/phrases: ${brand.doSay}` : "",
    brand.dontSay ? `NEVER USE these words/phrases: ${brand.dontSay}` : "",
  ].filter(Boolean).join("\n");

  // ── Build product context ──
  const productContext = productName
    ? [
        `Product: ${productName}`,
        productDesc ? `Description: ${productDesc}` : "",
        productPrice ? `Price: ฿${(productPrice / 100).toLocaleString()}` : "",
        productCategory ? `Category: ${productCategory}` : "",
        productTags.length > 0 ? `Tags: ${productTags.join(", ")}` : "",
      ].filter(Boolean).join("\n")
    : "";

  // ── Caption length guide ──
  const captionLenGuide: Record<string, string> = {
    Short: "สั้นกระชับ 3-5 บรรทัด ไม่เกิน 50 คำ",
    Medium: "ปานกลาง 6-12 บรรทัด 50-150 คำ",
    Long: "ยาวละเอียด 12-20 บรรทัด 150+ คำ พร้อม bullet points",
  };
  const lenGuide = captionLenGuide[campaign.captionLength ?? "Medium"] ?? captionLenGuide.Medium;

  // ── Platform-specific style ──
  const platformStyle: Record<string, string> = {
    Instagram: "Visual-first, aesthetic caption. Use line breaks for clean look. Emoji ไม่เยอะมาก. เน้น storytelling สั้นๆ + visual appeal. Caption ต้องอ่านง่าย scroll-stopping.",
    Facebook: "Storytelling ยาวขึ้นได้. เน้น share-worthy content. ใช้ emotional hook ให้แชร์ต่อ. เขียนแบบ conversational เหมือนคุยกับเพื่อน.",
    TikTok: "Caption สั้นมาก กระชับ. Hook แรงใน 2 วินาที. ใช้ภาษา Gen Z / slang ได้ถ้า tone เหมาะ. เน้น curiosity gap.",
    LINE: "Direct, ชัดเจน, promotional. เน้น benefit ตรงๆ. มี link/CTA ชัดเจน. เหมือนส่งข้อความหาลูกค้าโดยตรง.",
  };

  // ── Pillar-specific structure ──
  const pillarStructure: Record<string, string> = {
    Knowledge: `1. HOOK — คำถามหรือ fact ที่น่าสนใจ ทำให้อยากอ่านต่อ
2. TIPS/CONTENT — 3-5 tips หรือข้อมูลที่มีประโยชน์ แต่ละข้อมี emoji + หัวข้อ bold
3. BRAND TIE-IN — เชื่อมโยงกลับมาที่แบรนด์/สินค้าอย่างเป็นธรรมชาติ (ไม่ hard sell)
4. CTA — ชวน save, share, หรือ comment แชร์ประสบการณ์`,

    Product: `1. HOOK LINE — หัวข้อที่ดึงดูดความสนใจ (can include emoji)
2. OPENING — Emoji + intro ที่ทำให้อยากอ่านต่อ
3. PROBLEM/PAIN POINT — สถานการณ์ที่กลุ่มเป้าหมายเจอ
4. PRODUCT INTRO — แนะนำสินค้าพร้อม emoji, ชื่อแบรนด์, ชื่อสินค้า${productPrice ? `, ราคา ฿${(productPrice / 100).toLocaleString()}` : ""}
5. FEATURE BULLETS — 3-5 จุดเด่น แต่ละข้อมี emoji + ชื่อ feature — คำอธิบาย
6. VARIANTS/OPTIONS — ถ้ามีตัวเลือก ให้ list (ข้ามถ้าไม่มี)
7. CLOSING — ประโยคปิดที่สร้างอารมณ์/แรงบันดาลใจ
8. CTA — บอกชัดเจนว่าให้ทำอะไรต่อ`,

    Brand: `1. STORY HOOK — เปิดด้วยเรื่องราว/ที่มาที่น่าสนใจของแบรนด์
2. VALUES — สิ่งที่แบรนด์เชื่อ/ยึดมั่น เขียนให้ inspire
3. BEHIND THE SCENES — เบื้องหลัง/ความตั้งใจ ทำให้รู้สึกเชื่อมโยงกับแบรนด์
4. EMOTIONAL CLOSE — ปิดด้วยอารมณ์ที่ทำให้จดจำ
5. CTA — ชวน follow, share story, หรือ tag คนที่ควรรู้จักแบรนด์`,

    Promotion: `1. URGENCY HOOK — เปิดด้วยความเร่งด่วน/โอกาสพิเศษ (🔥, ⚡, 🎉)
2. OFFER DETAILS — รายละเอียดโปรโมชั่นชัดเจน (ลด%, ราคา, ของแถม)${productPrice ? ` ราคาปกติ ฿${(productPrice / 100).toLocaleString()}` : ""}
3. BENEFIT BULLETS — 2-3 เหตุผลว่าทำไมต้องซื้อตอนนี้
4. SCARCITY — จำกัดเวลา/จำนวน ทำให้รู้สึกว่าพลาดไม่ได้
5. CTA — บอกชัดว่าสั่งซื้อยังไง ง่ายที่สุด`,

    Others: `1. HOOK — เปิดให้น่าสนใจตามหัวข้อ
2. BODY — เนื้อหาหลัก ปรับตามหัวข้อ
3. BRAND CONNECTION — เชื่อมกลับมาที่แบรนด์
4. CTA — ชวนให้มี engagement`,
  };

  const pillar = campaign.pillar ?? "Product";
  const structure = pillarStructure[pillar] ?? pillarStructure.Product;

  const prompt = `You are an expert Thai social media copywriter specializing in ${campaign.channel} content.

═══ BRAND DNA ═══
${brandContext}
Brand voice tones: ${uniqueTones}
${voiceRules ? `\n═══ BRAND VOICE RULES (CRITICAL — follow strictly) ═══\n${voiceRules}` : ""}

═══ CAMPAIGN BRIEF ═══
Platform: ${campaign.channel}
Topic: ${campaign.topic}
${campaign.brief ? `Brief: ${campaign.brief}` : ""}
Content Pillar: ${pillar}
${campaign.goal ? `Goal: ${campaign.goal}` : ""}
${campaign.audience ? `Target Audience: ${campaign.audience}` : ""}
${productContext ? `\n═══ PRODUCT INFO ═══\n${productContext}` : ""}
${campaign.cta ? `CTA: ${campaign.cta}` : ""}
Language: ${campaign.language === "EN" ? "English" : campaign.language === "TH+EN" ? "Thai mixed with English terms" : "Thai"}

═══ PLATFORM STYLE (${campaign.channel}) ═══
${platformStyle[campaign.channel] ?? platformStyle.Instagram}

═══ POST STRUCTURE (follow this for "${pillar}" pillar) ═══
${structure}
${campaign.cta && campaign.cta !== "ไม่ระบุ" ? `Use this CTA: "${campaign.cta}"` : ""}

═══ GUIDELINES ═══
- Length: ${lenGuide}
- Tone: ${uniqueTones} — ให้ทุกประโยคสะท้อน tone นี้อย่างสม่ำเสมอ
- Use emojis naturally (ไม่มากเกิน 1-2 ตัวต่อบรรทัด)
- Use line breaks for readability
- Feature bullets format: emoji + feature name — description
- Write in ${campaign.language === "EN" ? "English" : campaign.language === "TH+EN" ? "Thai (ใช้ศัพท์ภาษาอังกฤษได้ตามธรรมชาติ)" : "Thai"}
${productPrice ? `- กล่าวถึงราคาสินค้า ฿${(productPrice / 100).toLocaleString()} ในโพสต์ถ้าเหมาะสมกับ pillar` : ""}
${productTags.length > 0 ? `- ใช้ keywords เหล่านี้ใน caption ถ้าเหมาะสม: ${productTags.join(", ")}` : ""}
- DO NOT include any footer, social links, hashtags, or brand signature — those are added separately
- DO NOT include divider lines (──) — those are added separately

═══ OUTPUT FORMAT ═══
Generate the caption and 8-12 relevant hashtags${productCategory ? ` (include hashtags related to "${productCategory}")` : ""}.

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
