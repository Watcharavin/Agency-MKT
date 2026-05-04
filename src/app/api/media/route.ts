import { NextRequest, NextResponse } from "next/server";

// GET /api/media?url=https://...blob.vercel-storage.com/...
// Public proxy for private blobs — used by KIE AI to download product images
// Security: only serves URLs from Vercel Blob domain
export async function GET(req: NextRequest) {
  const blobUrl = req.nextUrl.searchParams.get("url");
  if (!blobUrl) return new NextResponse("Missing url", { status: 400 });

  // Only allow Vercel Blob URLs
  if (!blobUrl.includes("blob.vercel-storage.com")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const res = await fetch(blobUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!res.ok) return new NextResponse("Not found", { status: 404 });

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
