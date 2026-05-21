import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands, socialAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ accounts: [] });

  const accounts = await db.select({
    id: socialAccounts.id,
    platform: socialAccounts.platform,
    platformAccountId: socialAccounts.platformAccountId,
    platformAccountName: socialAccounts.platformAccountName,
    isActive: socialAccounts.isActive,
    createdAt: socialAccounts.createdAt,
  }).from(socialAccounts).where(eq(socialAccounts.brandId, brandRows[0].id));

  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { platform, accessToken, platformAccountId, platformAccountName } = body;

  if (!platform || !accessToken) {
    return NextResponse.json({ error: "platform and accessToken required" }, { status: 400 });
  }

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const [account] = await db.insert(socialAccounts).values({
    brandId: brandRows[0].id,
    platform,
    accessToken,       // TODO: encrypt before storing
    platformAccountId: platformAccountId || null,
    platformAccountName: platformAccountName || null,
  }).returning({ id: socialAccounts.id });

  return NextResponse.json({ ok: true, id: account.id });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const accountId = url.searchParams.get("id");
  if (!accountId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  await db.delete(socialAccounts).where(
    and(eq(socialAccounts.id, accountId), eq(socialAccounts.brandId, brandRows[0].id))
  );

  return NextResponse.json({ ok: true });
}
