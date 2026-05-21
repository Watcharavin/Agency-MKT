import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  const host = req.headers.get("host")!;
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  if (!userId) return NextResponse.redirect(`${baseUrl}/sign-in`);

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/settings?meta_error=cancelled`);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(`${baseUrl}/settings?meta_error=not_configured`);
  }

  const redirectUri = `${baseUrl}/api/auth/meta/callback`;

  // 1. Exchange code for short-lived user token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${appSecret}` +
    `&code=${code}`
  );

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/settings?meta_error=token_exchange`);
  }

  const { access_token: shortToken } = await tokenRes.json();

  // 2. Exchange for long-lived user token (~60 days)
  const longTokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${appId}` +
    `&client_secret=${appSecret}` +
    `&fb_exchange_token=${shortToken}`
  );

  if (!longTokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/settings?meta_error=long_token`);
  }

  const { access_token: longToken } = await longTokenRes.json();

  // 3. Get Pages the user manages directly
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts` +
    `?fields=id,name,access_token,instagram_business_account{id,name,username}` +
    `&access_token=${longToken}`
  );

  if (!pagesRes.ok) {
    return NextResponse.redirect(`${baseUrl}/settings?meta_error=pages_fetch`);
  }

  const pagesData = await pagesRes.json();
  const pages: Record<string, unknown>[] = pagesData.data || [];

  // 4. Also get Pages from Business Portfolios
  const bizRes = await fetch(
    `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&access_token=${longToken}`
  );

  if (bizRes.ok) {
    const bizData = await bizRes.json();
    const businesses: { id: string }[] = bizData.data || [];

    await Promise.all(
      businesses.map(async (biz) => {
        const bizPagesRes = await fetch(
          `https://graph.facebook.com/v21.0/${biz.id}/owned_pages` +
          `?fields=id,name,access_token,instagram_business_account{id,name,username}` +
          `&access_token=${longToken}`
        );
        if (!bizPagesRes.ok) return;
        const bizPagesData = await bizPagesRes.json();
        for (const page of bizPagesData.data || []) {
          if (!pages.find((p) => p.id === page.id)) {
            pages.push(page);
          }
        }
      })
    );
  }

  // Store pages in a short-lived httpOnly cookie (10 min)
  const response = NextResponse.redirect(`${baseUrl}/settings?meta_pages=1`);
  response.cookies.set("meta_pages", JSON.stringify(pages), {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
