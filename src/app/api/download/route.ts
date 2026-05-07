import { NextRequest, NextResponse } from "next/server";

// GET /api/download?url=https://...&name=filename.jpg
// Proxy-download an image so the browser triggers Save-As
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const name = req.nextUrl.searchParams.get("name") ?? "image.jpg";
  if (!url) return new NextResponse("Missing url", { status: 400 });

  try {
    const res = await fetch(url);
    if (!res.ok) return new NextResponse("Not found", { status: 404 });
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'attachment; filename="' + name + '"',
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[download] fetch failed:", err);
    return new NextResponse("Error", { status: 500 });
  }
}
