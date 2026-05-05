"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Campaign, GeneratedAsset } from "@/db/schema";

const CHANNEL_FORMAT: Record<string, string> = {
  Facebook:  "16:9 · 1200×628",
  Instagram: "1:1 · 1080×1080",
  LINE:      "1:1 · 1040×1040",
  TikTok:    "9:16 · 1080×1920",
};

export function CampaignDetailClient({
  campaign,
  initialAssets,
}: {
  campaign: Campaign;
  initialAssets: GeneratedAsset[];
}) {
  const router = useRouter();
  const [assets, setAssets] = useState<GeneratedAsset[]>(initialAssets);
  const [running, setRunning] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<"caption" | "hashtags" | null>(null);

  const slides = assets.filter((a) => a.type === "slide").sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0));
  const caption = assets.find((a) => a.type === "caption")?.textContent ?? "";
  const hashtags = assets.find((a) => a.type === "hashtags")?.textContent ?? "";
  const slideCount = campaign.slideCount ?? 3;
  const isGenerated = slides.length > 0;

  async function handleGenerate() {
    setRunning(true);
    setError(null);
    setCompletedCount(0);
    setStatusText("กำลังสร้าง tasks…");

    try {
      // Step 1: Start generation
      const startRes = await fetch("/api/generate/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error ?? "Failed to start generation");
      }

      const { taskIds, caption: newCaption, hashtags: newHashtags } = await startRes.json() as {
        taskIds: string[];
        caption: string;
        hashtags: string;
        slideCount: number;
      };

      setStatusText(`รอผล ${taskIds.length} สไลด์…`);

      // Step 2: Poll all tasks in parallel
      const MAX_POLLS = 60; // 60 × 3s = 3 min
      const POLL_INTERVAL = 3000;

      async function pollTask(taskId: string): Promise<string | null> {
        for (let i = 0; i < MAX_POLLS; i++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL));
          try {
            const res = await fetch(`/api/generate/status/${taskId}`);
            if (!res.ok) continue;
            const { status, imageUrl } = await res.json();
            if (status === "completed") {
              setCompletedCount((prev) => prev + 1);
              return imageUrl ?? null;
            }
            if (status === "failed") {
              setCompletedCount((prev) => prev + 1);
              return null;
            }
          } catch {
            // network hiccup — retry
          }
        }
        setCompletedCount((prev) => prev + 1);
        return null;
      }

      const imageUrls = (await Promise.all(taskIds.map(pollTask))).filter((u): u is string => !!u);

      setStatusText("บันทึกลง database…");

      // Step 3: Save assets
      const saveRes = await fetch(`/api/campaigns/${campaign.id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls, caption: newCaption, hashtags: newHashtags }),
      });

      if (!saveRes.ok) throw new Error("Failed to save assets");

      setStatusText("เสร็จแล้ว!");

      // Refresh assets from server
      const refreshRes = await fetch(`/api/campaigns/${campaign.id}`);
      if (refreshRes.ok) {
        const { assets: freshAssets } = await refreshRes.json();
        setAssets(freshAssets);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
      setStatusText("");
    }
  }

  async function handleDelete() {
    if (!confirm("ลบ campaign นี้?")) return;
    setDeleting(true);
    await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
    router.push("/campaigns");
  }

  async function handleCopy(text: string, key: "caption" | "hashtags") {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleDownload(imageUrl: string, index: number) {
    const res = await fetch(`/api/download?url=${encodeURIComponent(imageUrl)}`);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${campaign.topic.slice(0, 30)}-slide-${index + 1}.jpg`;
    a.click();
  }

  return (
    <div className="space-y-5">

      {/* ── Generated slides ── */}
      {isGenerated ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">{slides.length} สไลด์ · {CHANNEL_FORMAT[campaign.channel] ?? campaign.channel}</p>
            <button
              onClick={handleGenerate}
              disabled={running}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
            >
              {running ? "กำลัง regenerate…" : "↺ Regenerate"}
            </button>
          </div>

          {/* Slides grid */}
          <div className={cn(
            "grid gap-3",
            slides.length === 1 ? "grid-cols-1 max-w-xs" :
            slides.length === 2 ? "grid-cols-2" :
            "grid-cols-3"
          )}>
            {slides.map((slide, i) => (
              <div key={slide.id} className="relative group rounded-lg overflow-hidden border border-border bg-secondary">
                {slide.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.imageUrl}
                    alt={`Slide ${i + 1}`}
                    className="w-full object-cover"
                  />
                ) : (
                  <div className="aspect-square flex items-center justify-center text-muted-foreground text-xs">
                    ไม่สำเร็จ
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                  <span className="text-[10px] font-mono text-white">Slide {i + 1}</span>
                  {slide.imageUrl && (
                    <button
                      onClick={() => handleDownload(slide.imageUrl!, i)}
                      className="rounded bg-white/20 backdrop-blur px-2 py-1 text-[10px] text-white hover:bg-white/30 transition-colors"
                    >
                      ↓ Download
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Caption */}
          {caption && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Caption</p>
                <button
                  onClick={() => handleCopy(caption, "caption")}
                  className="rounded px-2 py-1 text-[11px] bg-secondary hover:bg-border transition-colors text-foreground"
                >
                  {copied === "caption" ? "✓ คัดลอกแล้ว" : "คัดลอก"}
                </button>
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{caption}</pre>
            </div>
          )}

          {/* Hashtags */}
          {hashtags && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Hashtags</p>
                <button
                  onClick={() => handleCopy(hashtags, "hashtags")}
                  className="rounded px-2 py-1 text-[11px] bg-secondary hover:bg-border transition-colors text-foreground"
                >
                  {copied === "hashtags" ? "✓ คัดลอกแล้ว" : "คัดลอก"}
                </button>
              </div>
              <p className="text-xs text-primary font-mono leading-relaxed">{hashtags}</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Not yet generated ── */
        <div className="rounded-lg border border-border bg-card p-10 text-center space-y-3">
          {running ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">{statusText}</p>
              <div className="max-w-xs mx-auto space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>กำลัง generate…</span>
                  <span className="font-mono">{completedCount}/{slideCount}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${slideCount > 0 ? Math.round((completedCount / slideCount) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Slide preview tiles */}
              <div className="flex justify-center gap-2 mt-2">
                {Array.from({ length: slideCount }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-14 h-14 rounded-md border flex items-center justify-center text-[10px] font-mono transition-all duration-500",
                      completedCount > i
                        ? "border-green-400 bg-green-50 text-green-600"
                        : running
                        ? "border-border animate-pulse bg-secondary text-muted-foreground"
                        : "border-border bg-secondary text-muted-foreground"
                    )}
                  >
                    {completedCount > i ? "✓" : `S${i + 1}`}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-2xl">◑</p>
              <p className="text-sm font-medium text-foreground">รอ Generate</p>
              <p className="text-xs text-muted-foreground">
                AI สร้าง {slideCount} สไลด์ · caption · hashtags
              </p>
              <button
                onClick={handleGenerate}
                className="mt-2 rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-card hover:opacity-80 transition-opacity"
              >
                ▶ Generate Content
              </button>
              <p className="text-[10px] text-muted-foreground">~2–3 นาที · บันทึกอัตโนมัติ</p>
            </>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
        </div>
      )}

      {/* ── Delete ── */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-40"
        >
          {deleting ? "กำลังลบ…" : "ลบ Campaign นี้"}
        </button>
      </div>
    </div>
  );
}
