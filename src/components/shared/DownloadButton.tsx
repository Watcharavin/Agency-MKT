"use client";

import { useState } from "react";

export function DownloadButton({
  imageUrl,
  filename,
  variant = "icon",
  size = "md",
}: {
  imageUrl: string;
  filename: string;
  variant?: "icon" | "text";
  size?: "sm" | "md";
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      // Private Vercel Blob → proxy through /api/blob (carries auth cookies)
      // Other URLs (KIE CDN etc.) → proxy through /api/download
      const fetchUrl = imageUrl.includes("blob.vercel-storage.com")
        ? `/api/blob?url=${encodeURIComponent(imageUrl)}`
        : `/api/download?url=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(filename)}`;

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("[DownloadButton] failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const pad = size === "sm" ? "p-1.5" : "p-2.5";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";

  if (variant === "text") {
    return (
      <button
        onClick={handleDownload}
        disabled={loading}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline disabled:opacity-50"
      >
        {loading ? "กำลังโหลด..." : "ดาวน์โหลด"}
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={`${pad} rounded-lg bg-white/90 hover:bg-white text-zinc-800 transition-colors shadow-sm disabled:opacity-50`}
      title="ดาวน์โหลดรูปภาพ"
    >
      {loading ? (
        <span className={`${iconSize} block rounded-full border-2 border-zinc-400 border-t-zinc-800 animate-spin`} />
      ) : (
        <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
    </button>
  );
}
