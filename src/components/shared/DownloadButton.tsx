"use client";

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
  const href = `/api/download?url=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(filename)}`;

  if (variant === "text") {
    return (
      <a
        href={href}
        download={filename}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
      >
        ดาวน์โหลด
      </a>
    );
  }

  const pad = size === "sm" ? "p-1.5" : "p-2.5";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";

  return (
    <a
      href={href}
      download={filename}
      className={`${pad} rounded-lg bg-white/90 hover:bg-white text-zinc-800 transition-colors shadow-sm`}
      title="ดาวน์โหลดรูปภาพ"
    >
      <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </a>
  );
}
