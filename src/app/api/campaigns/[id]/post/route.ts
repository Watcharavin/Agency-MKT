import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, campaigns, socialAccounts, generatedAssets, postLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { postToLINE, postToFacebook, postToInstagram } from "@/lib/autopost";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const targetAccountIds: string[] = body.accountIds ?? [];

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const rows = await db.select().from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.brandId, brandRows[0].id))).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const campaign = rows[0];

  // Map campaign channel to platform
  const platformMap: Record<string, string> = {
    Facebook: "facebook",
    Instagram: "instagram",
    LINE: "line",
    TikTok: "tiktok",
  };
  const targetPlatform = platformMap[campaign.channel];
  if (!targetPlatform) {
    return NextResponse.json({ error: "Unsupported channel" }, { status: 400 });
  }

  // Find active social accounts, filtered by selected accountIds if provided
  const allAccounts = await db.select().from(socialAccounts)
    .where(and(
      eq(socialAccounts.brandId, campaign.brandId),
      eq(socialAccounts.platform, targetPlatform as "line" | "facebook" | "instagram" | "x" | "tiktok"),
      eq(socialAccounts.isActive, 1),
    ));
  const accounts = targetAccountIds.length > 0
    ? allAccounts.filter(a => targetAccountIds.includes(a.id))
    : allAccounts;

  if (accounts.length === 0) {
    return NextResponse.json({
      error: `No ${campaign.channel} account connected. Go to Settings to connect.`,
    }, { status: 400 });
  }

  // Get campaign assets
  const assets = await db.select().from(generatedAssets)
    .where(eq(generatedAssets.campaignId, campaign.id));

  const captionAsset = assets.find(a => a.type === "caption");
  const imageAsset = assets.find(a => a.type === "slide" && a.slideIndex === 0);
  const hashtagAsset = assets.find(a => a.type === "hashtags");

  const caption = [captionAsset?.textContent, hashtagAsset?.textContent].filter(Boolean).join("\n\n");
  const imageUrl = imageAsset?.imageUrl || undefined;

  if (!caption && !imageUrl) {
    return NextResponse.json({ error: "No content to post. Generate content first." }, { status: 400 });
  }

  const results: Array<{ platform: string; status: string; postUrl?: string; error?: string }> = [];

  for (const account of accounts) {
    try {
      let result: { success: boolean; postId?: string; postUrl?: string };

      switch (account.platform) {
        case "line":
          result = await postToLINE(account.accessToken, caption, imageUrl);
          break;
        case "facebook":
          result = await postToFacebook(account.accessToken, account.platformAccountId || "", caption, imageUrl);
          break;
        case "instagram":
          if (!imageUrl) throw new Error("Instagram requires an image");
          result = await postToInstagram(account.accessToken, account.platformAccountId || "", caption, imageUrl);
          break;
        default:
          continue;
      }

      await db.insert(postLogs).values({
        campaignId: campaign.id,
        socialAccountId: account.id,
        platform: account.platform,
        status: "success",
        platformPostId: result.postId || null,
        platformPostUrl: result.postUrl || null,
        postedAt: new Date(),
      });

      results.push({ platform: account.platform, status: "success", postUrl: result.postUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";

      await db.insert(postLogs).values({
        campaignId: campaign.id,
        socialAccountId: account.id,
        platform: account.platform,
        status: "failed",
        errorMessage: msg,
        createdAt: new Date(),
      });

      results.push({ platform: account.platform, status: "failed", error: msg });
    }
  }

  // Update campaign status to published
  await db.update(campaigns)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id));

  return NextResponse.json({ ok: true, results });
}
