import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { defaultPostTime } = body;

  if (!defaultPostTime) return NextResponse.json({ error: "defaultPostTime required" }, { status: 400 });

  await db.update(brands)
    .set({ defaultPostTime, updatedAt: new Date() })
    .where(eq(brands.userId, userId));

  return NextResponse.json({ ok: true });
}
