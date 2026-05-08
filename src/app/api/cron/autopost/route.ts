import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { campaigns, socialAccounts, postLogs, generatedAssets } from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { postToLINE, postToFacebook, postToInstagram } from "@/lib/autopost";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find campaigns ready to post: scheduled + scheduledAt <= now
  const readyCampaigns = await db.select().from(campaigns)
    .where(and(
      eq(campaigns.status, "scheduled"),
      lte(campaigns.scheduledAt, now),
    ));

  if (readyCampaigns.length === 0) {
    return NextResponse.json({ posted: 0 });
  }

  let posted = 0;
  const errors: string[] = [];

  for (const campaign of readyCampaigns) {
    // Get active social accounts for this brand matching the campaign channel
    const platformMap: Record<string, string> = {
      Facebook: "facebook",
      Instagram: "instagram",
      LINE: "line",
      TikTok: "tiktok",
    };
    const targetPlatform = platformMap[campaign.channel];
    if (!targetPlatform) continue;

    const accounts = await db.select().from(socialAccounts)
      .where(and(
        eq(socialAccounts.brandId, campaign.brandId),
        eq(socialAccounts.platform, targetPlatform as "line" | "facebook" | "instagram" | "x" | "tiktok"),
        eq(socialAccounts.isActive, 1),
      ));

    if (accounts.length === 0) continue;

    // Get campaign assets (caption + first image)
    const assets = await db.select().from(generatedAssets)
      .where(eq(generatedAssets.campaignId, campaign.id));

    const captionAsset = assets.find(a => a.type === "caption");
    const imageAsset = assets.find(a => a.type === "slide" && a.slideIndex === 0);
    const hashtagAsset = assets.find(a => a.type === "hashtags");

    const caption = [captionAsset?.textContent, hashtagAsset?.textContent].filter(Boolean).join("\n\n");
    const imageUrl = imageAsset?.imageUrl || undefined;

    for (const account of accounts) {
      try {
        let result: { success: boolean; postId?: string; postUrl?: string };

        switch (account.platform) {
          case "line":
            result = await postToLINE(account.accessToken, caption, imageUrl);
            break;
          case "facebook":
            result = await postToFacebook(
              account.accessToken,
              account.platformAccountId || "",
              caption,
              imageUrl,
            );
            break;
          case "instagram":
            if (!imageUrl) {
              result = { success: false };
              throw new Error("Instagram requires an image");
            }
            result = await postToInstagram(
              account.accessToken,
              account.platformAccountId || "",
              caption,
              imageUrl,
            );
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

        posted++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${campaign.id}/${account.platform}: ${msg}`);

        await db.insert(postLogs).values({
          campaignId: campaign.id,
          socialAccountId: account.id,
          platform: account.platform,
          status: "failed",
          errorMessage: msg,
          retryCount: 0,
          createdAt: new Date(),
        });
      }
    }

    // Update campaign status to published
    await db.update(campaigns)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(campaigns.id, campaign.id));
  }

  return NextResponse.json({ posted, errors: errors.length > 0 ? errors : undefined });
}
