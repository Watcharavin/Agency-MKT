import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// Server-side direct upload — file comes through the server, stored as private blob
// Max ~4 MB per file (Vercel serverless body limit is 4.5 MB)
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: `ไฟล์ไม่รองรับ (${file.type}) — ใช้ได้เฉพาะ JPG, PNG, WEBP` }, { status: 400 });
  }

  try {
    const blob = await put(`products/${Date.now()}-${file.name}`, file, {
      access: "private",
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[products/upload-file] put failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
