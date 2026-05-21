import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appId = process.env.META_APP_ID;
  if (!appId) return NextResponse.json({ error: "META_APP_ID not configured" }, { status: 500 });

  const host = req.headers.get("host")!;
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/meta/callback`;

  const scope = [
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_content_publish",
    "business_management",
  ].join(",");

  const url =
    `https://www.facebook.com/dialog/oauth` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code`;

  return NextResponse.redirect(url);
}
