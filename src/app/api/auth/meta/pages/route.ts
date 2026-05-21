import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const pagesCookie = cookieStore.get("meta_pages");

  if (!pagesCookie) {
    return NextResponse.json({ pages: [] });
  }

  const pages = JSON.parse(pagesCookie.value);
  return NextResponse.json({ pages });
}
