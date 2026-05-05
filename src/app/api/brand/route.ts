import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, tagline, about, audience, primaryColor, secondaryColor, thirdColor, logoUrl, toneTags, channels, languages, doSay, dontSay, displayFont, bodyFont } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Upsert: one brand per user for now
  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(brands)
      .set({ name, tagline, about, audience, primaryColor, secondaryColor, thirdColor, logoUrl: logoUrl ?? null, toneTags, channels, languages, doSay, dontSay, displayFont, bodyFont, updatedAt: new Date() })
      .where(eq(brands.userId, userId));
  } else {
    await db.insert(brands).values({
      userId, name, tagline, about, audience,
      primaryColor, secondaryColor, thirdColor, logoUrl: logoUrl ?? null,
      toneTags, channels, languages, doSay, dontSay, displayFont, bodyFont,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(brands)
    .where(eq(brands.userId, userId))
    .limit(1);

  return NextResponse.json(rows[0] ?? null);
}
