import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { brands, campaigns, generatedAssets } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function mirrorToBlobStore(kieUrl: string, path: string): Promise<string> {
  try {
    const res = await fetch(kieUrl);
    if (!res.ok) return kieUrl;
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const blob = await put(path, Buffer.from(buffer), { access: "private", contentType });
    return blob.url;
  } catch {
    return kieUrl;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { imageUrls: string[]; caption: string; hashtags: string };

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const campaignRows = await db.select({ id: campaigns.id }).from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.brandId, brandRows[0].id))).limit(1);
  if (campaignRows.length === 0) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // Replace old assets
  await db.delete(generatedAssets).where(eq(generatedAssets.campaignId, id));

  // Mirror KIE URLs to Vercel Blob in parallel
  const blobUrls = await Promise.all(
    body.imageUrls.map((url, i) =>
      mirrorToBlobStore(url, `generated/campaigns/${id}/slide-${i}.jpg`)
    )
  );

  // Insert slide images
  for (let i = 0; i < blobUrls.length; i++) {
    await db.insert(generatedAssets).values({
      campaignId: id,
      type: "slide",
      slideIndex: i,
      imageUrl: blobUrls[i],
    });
  }

  if (body.caption) {
    await db.insert(generatedAssets).values({ campaignId: id, type: "caption", textContent: body.caption });
  }

  if (body.hashtags) {
    await db.insert(generatedAssets).values({ campaignId: id, type: "hashtags", textContent: body.hashtags });
  }

  // Mark campaign as generated
  await db.update(campaigns)
    .set({ status: "generated", updatedAt: new Date() })
    .where(eq(campaigns.id, id));

  return NextResponse.json({ ok: true });
}
