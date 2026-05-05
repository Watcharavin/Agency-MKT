import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, campaigns, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const KIE_BASE = "https://api.kie.ai";

const CHANNEL_ASPECT: Record<string, string> = {
  Facebook:  "16:9",
  Instagram: "1:1",
  LINE:      "1:1",
  TikTok:    "9:16",
};

async function createKieTask(inputUrls: string[], prompt: string, aspectRatio: string): Promise<string> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error("KIE_API_KEY not set");

  const body = {
    model: "gpt-image-2-image-to-image",
    input: { prompt, input_urls: inputUrls, aspect_ratio: aspectRatio },
  };

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE createTask failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const taskId = data.data?.taskId ?? data.taskId ?? data.data?.task_id ?? data.data?.id;
  if (!taskId) throw new Error(`KIE no taskId in response: ${JSON.stringify(data)}`);
  return taskId;
}

function toPublicUrl(url: string): string {
  if (url.includes("public.blob.vercel-storage.com")) return url;
  if (url.includes("blob.vercel-storage.com")) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    if (appUrl) return `${appUrl}/api/media?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function buildCaption(
  brand: { name?: string | null; tagline?: string | null },
  campaign: { topic: string; brief?: string | null; language?: string | null }
): string {
  const isTH = !campaign.language || campaign.language.includes("TH");
  const lines: string[] = [];
  lines.push(campaign.topic);
  if (campaign.brief) lines.push(campaign.brief);
  if (brand.tagline) lines.push(`✨ ${brand.tagline}`);
  lines.push(isTH
    ? `\n📱 ติดตามเพิ่มเติมได้ที่ ${brand.name ?? ""}`
    : `\n📱 Follow us at ${brand.name ?? ""}`
  );
  return lines.filter(Boolean).join("\n");
}

function buildHashtags(
  brand: { name?: string | null },
  campaign: { channel: string; topic: string; language?: string | null }
): string {
  const brandTag = brand.name ? `#${brand.name.replace(/\s+/g, "")}` : "";
  const channelTags: Record<string, string[]> = {
    Facebook:  ["#FacebookMarketing", "#SocialMedia"],
    Instagram: ["#Instagram", "#Reels", "#Explore"],
    LINE:      ["#LINEoa", "#LINEOA", "#LineMarketing"],
    TikTok:    ["#TikTok", "#FYP", "#ForYouPage", "#TikTokMarketing"],
  };
  const isTH = !campaign.language || campaign.language.includes("TH");
  const langTags = isTH
    ? ["#ไทย", "#โปรโมชั่น", "#มาร์เก็ตติ้ง"]
    : ["#Marketing", "#Brand", "#Promotion"];

  return [brandTag, ...(channelTags[campaign.channel] ?? []), ...langTags].filter(Boolean).join(" ");
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { campaignId } = body;
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  // Fetch brand DNA
  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  const brand = brandRows[0];

  // Fetch campaign (verify ownership)
  const campaignRows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.brandId, brand.id)))
    .limit(1);
  if (campaignRows.length === 0) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  const campaign = campaignRows[0];

  // Fetch product photos if linked
  let productPhotos: string[] = [];
  if (campaign.productId) {
    const productRows = await db
      .select({ photoUrls: products.photoUrls })
      .from(products)
      .where(eq(products.id, campaign.productId))
      .limit(1);
    if (productRows.length > 0) {
      productPhotos = (productRows[0].photoUrls as string[]) ?? [];
    }
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://agency-mkt.vercel.app");
  const FALLBACK = `${appUrl}/placeholder.jpg`;
  const logoUrl = brand.logoUrl ? toPublicUrl(brand.logoUrl) : null;

  function buildInputUrls(rawPhotos: string[]): string[] {
    const photos = rawPhotos.length > 0 ? rawPhotos.slice(0, 3) : [FALLBACK];
    const urls = photos.map(toPublicUrl).filter(Boolean);
    return logoUrl ? [logoUrl, ...urls] : urls;
  }

  const aspectRatio = CHANNEL_ASPECT[campaign.channel] ?? "1:1";
  const toneStr = [campaign.tone, ...((brand.toneTags as string[]) ?? [])].filter(Boolean).join(", ");
  const slideCount = campaign.slideCount ?? 3;

  const basePrompt = [
    `Social media ${campaign.channel} carousel post. Topic: ${campaign.topic}.`,
    campaign.brief ? `Brief: ${campaign.brief}` : "",
    `Brand: ${brand.name ?? ""}`,
    brand.tagline ? `Tagline: "${brand.tagline}"` : "",
    brand.audience ? `Target audience: ${brand.audience}` : "",
    toneStr ? `Tone: ${toneStr}` : "",
    brand.primaryColor
      ? `Brand colors: primary ${brand.primaryColor}${brand.secondaryColor ? `, secondary ${brand.secondaryColor}` : ""}${brand.thirdColor ? `, accent ${brand.thirdColor}` : ""}`
      : "",
    brand.doSay ? `Do say: ${brand.doSay}` : "",
    brand.dontSay ? `Do NOT say: ${brand.dontSay}` : "",
    "High-quality marketing image, clean minimal design, on-brand typography.",
  ].filter(Boolean).join(" ");

  const inputUrls = buildInputUrls(productPhotos);

  // Update status to generating
  await db.update(campaigns).set({ status: "generating", updatedAt: new Date() }).where(eq(campaigns.id, campaignId));

  // Create one KIE task per slide
  const taskIds: string[] = [];
  for (let i = 0; i < slideCount; i++) {
    const slidePrompt = `${basePrompt} Slide ${i + 1} of ${slideCount}${i === 0 ? " — hero/cover slide" : i === slideCount - 1 ? " — CTA/closing slide" : ""}.`;
    try {
      const taskId = await createKieTask(inputUrls, slidePrompt, aspectRatio);
      taskIds.push(taskId);
    } catch (err) {
      console.error(`[generate/campaign] slide ${i} failed:`, err);
      // Roll back status
      await db.update(campaigns).set({ status: "draft", updatedAt: new Date() }).where(eq(campaigns.id, campaignId));
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // Generate caption + hashtags (template-based)
  const caption = buildCaption(brand, campaign);
  const hashtags = buildHashtags(brand, campaign);

  return NextResponse.json({ ok: true, taskIds, caption, hashtags, slideCount });
}
