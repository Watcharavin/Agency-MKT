import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, voucherCollections, coupons, products } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const KIE_BASE = "https://api.kie.ai";

async function createKieTask(inputUrls: string[], prompt: string): Promise<string> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error("KIE_API_KEY not set");

  const body = {
    model: "gpt-image-2-image-to-image",
    input: {
      prompt,
      input_urls: inputUrls,
      aspect_ratio: "1:1",
    },
  };
  console.log("[KIE createTask request]", JSON.stringify(body));

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE createTask failed: ${res.status} ${text} | sent: ${JSON.stringify(body)}`);
  }

  const data = await res.json();
  // Log full response so we can see the real shape
  console.log("[KIE createTask response]", JSON.stringify(data));
  // KIE returns { taskId: "..." } or { data: { taskId: "..." } } or { data: { jobId: "..." } }
  const taskId =
    data.data?.taskId ??   // ✅ {"code":200,"data":{"taskId":"..."}}
    data.taskId ??
    data.data?.task_id ??
    data.data?.id;
  if (!taskId) throw new Error(`KIE no taskId in response: ${JSON.stringify(data)}`);
  return taskId;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { voucherId, prompt, tones, slogan } = body;

  if (!voucherId) return NextResponse.json({ error: "voucherId required" }, { status: 400 });

  // Fetch full brand DNA
  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  const brand = brandRows[0];
  const brandId = brand.id;

  // Verify voucher belongs to this brand
  const voucherRows = await db
    .select()
    .from(voucherCollections)
    .where(and(eq(voucherCollections.id, voucherId), eq(voucherCollections.brandId, brandId)))
    .limit(1);

  if (voucherRows.length === 0) return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
  const voucher = voucherRows[0];

  // Get all coupons with their products
  const couponRows = await db
    .select()
    .from(coupons)
    .where(eq(coupons.collectionId, voucherId))
    .orderBy(coupons.sortOrder);

  // Collect product IDs for coupons that have one
  const productIds = couponRows.map((c) => c.productId).filter((id): id is string => !!id);
  const productMap = new Map<string, string[]>();

  if (productIds.length > 0) {
    const productRows = await db
      .select({ id: products.id, photoUrls: products.photoUrls })
      .from(products)
      .where(inArray(products.id, productIds));

    for (const p of productRows) {
      productMap.set(p.id, (p.photoUrls as string[]) ?? []);
    }
  }

  // Build full prompt with Brand DNA + voucher detail
  const toneStr = [
    ...((tones as string[]) ?? []),
    ...((brand.toneTags as string[]) ?? []),
  ].filter(Boolean).join(", ");

  const fullPrompt = [
    prompt,
    // Brand DNA
    brand.name ? `Brand name: ${brand.name}` : "",
    brand.tagline ? `Tagline: "${brand.tagline}"` : "",
    brand.about ? `About: ${brand.about}` : "",
    brand.audience ? `Target audience: ${brand.audience}` : "",
    toneStr ? `Tone & style: ${toneStr}` : "",
    brand.primaryColor ? `Primary brand color: ${brand.primaryColor}` : "",
    brand.doSay ? `Do say: ${brand.doSay}` : "",
    brand.dontSay ? `Do NOT say or show: ${brand.dontSay}` : "",
    // Voucher detail
    slogan ? `Slogan: "${slogan}"` : "",
    voucher.description ? `Voucher description: ${voucher.description}` : "",
    voucher.caption ? `Caption: ${voucher.caption}` : "",
    voucher.valueCap ? `Value cap: ${voucher.valueCap}` : "",
    // Quality directive
    "High quality product marketing image, clean minimal design, 1080x1080.",
  ]
    .filter(Boolean)
    .join(". ");

  // We'll generate: 1 voucher cover + N coupon images
  // For each we pick the first available photo of the linked product
  const tasks: Array<{ label: string; couponId?: string; taskId: string }> = [];

  // Convert private blob URL → publicly accessible proxy URL for KIE
  // In production: https://full-agency.vercel.app/api/blob?url=...
  // In dev: KIE can't reach localhost, so use URL as-is (will fail but dev only)
  function toPublicUrl(url: string): string {
    // Only proxy private Vercel Blob URLs — pass everything else (Unsplash, etc.) directly
    if (!url.includes("blob.vercel-storage.com")) return url;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    if (appUrl) {
      return `${appUrl}/api/media?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  // Gather all input photos (fallback to our own hosted placeholder — no redirects)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://agency-mkt.vercel.app");
  const FALLBACK_IMAGE = `${appUrl}/placeholder.jpg`;

  // --- Voucher cover task ---
  const firstProductPhotos = productIds.length > 0 ? productMap.get(productIds[0]) ?? [] : [];
  const rawCoverUrls = firstProductPhotos.length > 0 ? firstProductPhotos.slice(0, 4) : [FALLBACK_IMAGE];
  const coverInputUrls = rawCoverUrls.map(toPublicUrl).filter((u) => u.length > 0);

  console.log("[generate/voucher] productIds:", productIds);
  console.log("[generate/voucher] productMap:", Object.fromEntries(productMap));
  console.log("[generate/voucher] coverInputUrls:", coverInputUrls);

  try {
    const taskId = await createKieTask(coverInputUrls, `${fullPrompt}. Hero cover image representing the entire voucher bundle.`);
    tasks.push({ label: "voucher_cover", taskId });
  } catch (err) {
    console.error("KIE cover task failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  // --- Collection (merged) task ---
  // Use all product photos together for a "merged" feel
  const allPhotos = [...new Set(
    couponRows.flatMap((c) => (c.productId ? productMap.get(c.productId) ?? [] : []))
  )].slice(0, 4);
  const collectionUrls = allPhotos.length > 0
    ? allPhotos.map(toPublicUrl).filter((u) => u.length > 0)
    : coverInputUrls;

  try {
    const taskId = await createKieTask(collectionUrls, `${fullPrompt}. Collection overview — show all ${couponRows.length} coupons composited into one promotional image.`);
    tasks.push({ label: "collection", taskId });
  } catch (err) {
    console.error("KIE collection task failed", err);
    // non-fatal, continue
  }

  // --- Per-coupon tasks ---
  for (const coupon of couponRows) {
    const photos = coupon.productId ? (productMap.get(coupon.productId) ?? []) : [];
    const rawUrls = photos.length > 0 ? photos.slice(0, 4) : [FALLBACK_IMAGE];
    const inputUrls = rawUrls.map(toPublicUrl).filter((u) => u.length > 0);

    try {
      const taskId = await createKieTask(
        inputUrls,
        `${fullPrompt}. This is for coupon "${coupon.name}" – discount ${coupon.discount ?? ""}.`
      );
      tasks.push({ label: "coupon", couponId: coupon.id, taskId });
    } catch (err) {
      console.error(`KIE coupon task failed for ${coupon.id}`, err);
      // Continue with remaining coupons
    }
  }

  return NextResponse.json({ ok: true, tasks, voucherId });
}
