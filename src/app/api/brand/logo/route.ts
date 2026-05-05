import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Server-side logo upload — avoids client-side CDN callback issues
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  try {
    const blob = await put(`brand/${userId}-${Date.now()}-${file.name}`, file, {
      access: "private",
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[brand/logo] put failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
