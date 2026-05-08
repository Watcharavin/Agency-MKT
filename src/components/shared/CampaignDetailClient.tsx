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

const CHANNELS = ["Facebook", "Instagram", "LINE", "TikTok"];
const TONES = ["Educational", "Casual", "Professional", "Playful", "Inspirational", "Luxury"];
const LANGUAGES = ["TH", "EN", "TH+EN"];
const CAPTION_LENGTHS = ["Short", "Medium", "Long"];
const FOOTER_STYLES = ["Full", "Shopee", "LINE", "Min", "ไม่ใส่"];
const RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"];

type Phase = "idle" | "generating_text" | "review_text" | "generating_images" | "done" | "editing";

export function CampaignDetailClient({
  campaign: initialCampaign,
  initialAssets,
}: {
  campaign: Campaign;
  initialAssets: GeneratedAsset[];
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [assets, setAssets] = useState<GeneratedAsset[]>(initialAssets);
  const [phase, setPhase] = useState<Phase>(initialAssets.length > 0 ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<"caption" | "hashtags" | null>(null);
  const [saving, setSaving] = useState(false);

  // Text fields (editable in review phase)
  const [caption, setCaption] = useState(assets.find((a) => a.type === "caption")?.textContent ?? "");
  const [hashtags, setHashtags] = useState(assets.find((a) => a.type === "hashtags")?.textContent ?? "");

  // Per-slide image config
  const defaultRatio = campaign.imageRatio ?? "1:1";
  const [slideRatios, setSlideRatios] = useState<string[]>(
    Array.from({ length: campaign.slideCount ?? 3 }, () => defaultRatio)
  );

  // Edit form state
  const [editForm, setEditForm] = useState({
    topic: campaign.topic,
    channel: campaign.channel,
    brief: campaign.brief ?? "",
    audience: campaign.audience ?? "",
    tone: campaign.tone ?? "Educational",
    language: campaign.language ?? "TH",
    pillar: campaign.pillar ?? "",
    goal: campaign.goal ?? "",
    cta: campaign.cta ?? "",
    captionLength: campaign.captionLength ?? "Medium",
    footerStyle: campaign.footerStyle ?? "Full",
    slideRatios: Array.from({ length: campaign.slideCount ?? 3 }, () => campaign.imageRatio ?? "1:1"),
  });

  // Image generation progress
  const [completedCount, setCompletedCount] = useState(0);
  const [statusText, setStatusText] = useState("");

  const slides = assets.filter((a) => a.type === "slide").sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0));
  const slideCount = slideRatios.length;

  // ─── Step 1: Generate Text (AI caption + footer + hashtags) ───
  async function handleGenerateText() {
    setPhase("generating_text");
    setError(null);

    try {
      const res = await fetch("/api/generate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to generate text");
      }

      const data = await res.json();
      setCaption(data.caption ?? "");
      setHashtags(data.hashtags ?? "");
      setPhase("review_text");
    } catch (err) {
      setError(String(err));
      setPhase("idle");
    }
  }

  // ─── Step 2: Generate Images (KIE) after user approves text ───
  async function handleGenerateImages() {
    setPhase("generating_images");
    setError(null);
    setCompletedCount(0);
    setStatusText("กำลังสร้าง tasks…");

    try {
      const startRes = await fetch("/api/generate/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, slideRatios, caption }),
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error ?? "Failed to start image generation");
      }

      const { taskIds } = await startRes.json() as { taskIds: string[]; slideCount: number };
      setStatusText(`รอผล ${taskIds.length} สไลด์…`);

      const MAX_POLLS = 60;
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

      const saveRes = await fetch(`/api/campaigns/${campaign.id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls, caption, hashtags }),
      });

      if (!saveRes.ok) throw new Error("Failed to save assets");

      setStatusText("เสร็จแล้ว!");

      const refreshRes = await fetch(`/api/campaigns/${campaign.id}`);
      if (refreshRes.ok) {
        const { assets: freshAssets } = await refreshRes.json();
        setAssets(freshAssets);
      }
      setPhase("done");
    } catch (err) {
      setError(String(err));
      setPhase("review_text");
    } finally {
      setStatusText("");
    }
  }

  // ─── Edit campaign ───
  function handleStartEdit() {
    setEditForm({
      topic: campaign.topic,
      channel: campaign.channel,
      brief: campaign.brief ?? "",
      audience: campaign.audience ?? "",
      tone: campaign.tone ?? "Educational",
      language: campaign.language ?? "TH",
      pillar: campaign.pillar ?? "",
      goal: campaign.goal ?? "",
      cta: campaign.cta ?? "",
      captionLength: campaign.captionLength ?? "Medium",
      footerStyle: campaign.footerStyle ?? "Full",
      slideRatios: Array.from({ length: campaign.slideCount ?? 3 }, () => campaign.imageRatio ?? "1:1"),
    });
    setPhase("editing");
    setError(null);
  }

  async function handleSaveEdit() {
    setSaving(true);
    setError(null);
    try {
      const { slideRatios: editRatios, ...rest } = editForm;
      const payload = {
        ...rest,
        slideCount: editRatios.length,
        imageRatio: editRatios[0] ?? "1:1",
      };
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");

      // Update local campaign state + sync slideRatios
      setCampaign((prev) => ({ ...prev, ...payload }));
      setSlideRatios(editRatios);
      setPhase(assets.length > 0 ? "done" : "idle");
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  // ─── Slide config helpers ───
  function addSlide() {
    setSlideRatios((prev) => [...prev, defaultRatio]);
  }

  function removeSlide(index: number) {
    if (slideRatios.length <= 1) return;
    setSlideRatios((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSlideRatio(index: number, ratio: string) {
    setSlideRatios((prev) => prev.map((r, i) => (i === index ? ratio : r)));
  }

  // ─── Full regenerate (start from step 1 again) ───
  function handleRegenerate() {
    setPhase("idle");
    setCaption("");
    setHashtags("");
    setCompletedCount(0);
  }

  async function handleDelete() {
    if (!confirm("ลบ campaign นี้? ข้อมูลและรูปทั้งหมดจะหายไป")) return;
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

      {/* ═══ Phase: Editing campaign details ═══ */}
      {phase === "editing" && (
        <div className="rounded-lg border-2 border-primary/30 bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">แก้ไข Campaign</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Topic */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Topic</label>
              <input
                value={editForm.topic}
                onChange={(e) => setEditForm((f) => ({ ...f, topic: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Channel */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Channel</label>
              <select
                value={editForm.channel}
                onChange={(e) => setEditForm((f) => ({ ...f, channel: e.target.value as typeof f.channel }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>

            {/* Tone */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tone</label>
              <select
                value={editForm.tone}
                onChange={(e) => setEditForm((f) => ({ ...f, tone: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Language */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ภาษา</label>
              <select
                value={editForm.language}
                onChange={(e) => setEditForm((f) => ({ ...f, language: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Slides & Per-slide Ratio */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground">จำนวนสไลด์ & Ratio แต่ละรูป</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setEditForm((f) => {
                          const prev = f.slideRatios;
                          const defaultR = f.slideRatios[0] ?? "1:1";
                          const next =
                            n > prev.length
                              ? [...prev, ...Array.from({ length: n - prev.length }, () => defaultR)]
                              : prev.slice(0, n);
                          return { ...f, slideRatios: next };
                        })
                      }
                      className={cn(
                        "w-8 h-8 rounded-md border text-xs font-medium transition-all",
                        editForm.slideRatios.length === n
                          ? "border-foreground bg-foreground text-card"
                          : "border-border bg-background text-foreground hover:border-foreground/40"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {editForm.slideRatios.map((ratio, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground w-14 shrink-0">รูป {i + 1}</span>
                    <div className="flex gap-1">
                      {RATIOS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() =>
                            setEditForm((f) => ({
                              ...f,
                              slideRatios: f.slideRatios.map((sr, si) => (si === i ? r : sr)),
                            }))
                          }
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-[11px] font-mono transition-all",
                            ratio === r
                              ? "bg-foreground text-card border-foreground"
                              : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Caption Length */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ความยาว Caption</label>
              <select
                value={editForm.captionLength}
                onChange={(e) => setEditForm((f) => ({ ...f, captionLength: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CAPTION_LENGTHS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Footer Style */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Footer</label>
              <select
                value={editForm.footerStyle}
                onChange={(e) => setEditForm((f) => ({ ...f, footerStyle: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {FOOTER_STYLES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Pillar */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Content Pillar</label>
              <input
                value={editForm.pillar}
                onChange={(e) => setEditForm((f) => ({ ...f, pillar: e.target.value }))}
                placeholder="เช่น Awareness, Product, Promo"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Goal */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">เป้าหมาย</label>
              <input
                value={editForm.goal}
                onChange={(e) => setEditForm((f) => ({ ...f, goal: e.target.value }))}
                placeholder="เช่น Engagement, Reach, Sales"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Audience */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">กลุ่มเป้าหมาย</label>
              <input
                value={editForm.audience}
                onChange={(e) => setEditForm((f) => ({ ...f, audience: e.target.value }))}
                placeholder="เช่น ผู้หญิงวัย 25-35 สนใจแฟชั่น"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* CTA */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">CTA</label>
              <input
                value={editForm.cta}
                onChange={(e) => setEditForm((f) => ({ ...f, cta: e.target.value }))}
                placeholder="เช่น ช้อปเลย, สั่งซื้อวันนี้"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Brief */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Brief</label>
              <textarea
                value={editForm.brief}
                onChange={(e) => setEditForm((f) => ({ ...f, brief: e.target.value }))}
                rows={3}
                placeholder="รายละเอียดเพิ่มเติม..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editForm.topic.trim()}
              className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            <button
              onClick={() => setPhase(assets.length > 0 ? "done" : "idle")}
              className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* ═══ Phase: Done — show results ═══ */}
      {phase === "done" && slides.length > 0 && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">{slides.length} สไลด์ · {CHANNEL_FORMAT[campaign.channel] ?? campaign.channel}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartEdit}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
              >
                แก้ไข
              </button>
              <button
                onClick={handleRegenerate}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
              >
                ↺ Regenerate
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-red-200 bg-background px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                {deleting ? "กำลังลบ…" : "ลบ"}
              </button>
            </div>
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
                  <img src={slide.imageUrl} alt={`Slide ${i + 1}`} className="w-full object-cover" />
                ) : (
                  <div className="aspect-square flex items-center justify-center text-muted-foreground text-xs">ไม่สำเร็จ</div>
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

          {/* Caption (read-only) */}
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

          {/* Hashtags (read-only) */}
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
      )}

      {/* ═══ Phase: Review Text — editable caption/hashtags ═══ */}
      {phase === "review_text" && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-primary/30 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-card text-xs font-bold">1</span>
              <h3 className="text-sm font-semibold text-foreground">ตรวจสอบ & แก้ไขข้อความ</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Hashtags</label>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-primary font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* ── Image config: slide count + per-slide ratio ── */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-card text-xs font-bold">2</span>
                <h3 className="text-sm font-semibold text-foreground">ตั้งค่ารูปภาพ</h3>
                <span className="text-[10px] text-muted-foreground">({slideRatios.length} รูป)</span>
              </div>

              <div className="space-y-2">
                {slideRatios.map((ratio, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground w-14">รูป {i + 1}</span>
                    <div className="flex gap-1">
                      {RATIOS.map((r) => (
                        <button
                          key={r}
                          onClick={() => updateSlideRatio(i, r)}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-[11px] font-mono border transition-colors",
                            ratio === r
                              ? "bg-foreground text-card border-foreground"
                              : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    {slideRatios.length > 1 && (
                      <button
                        onClick={() => removeSlide(i)}
                        className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors ml-1"
                        title="ลบรูปนี้"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addSlide}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border rounded-md px-3 py-1.5 hover:border-foreground/30"
              >
                + เพิ่มรูป
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleGenerateImages}
                className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-card hover:opacity-80 transition-opacity"
              >
                ✓ อนุมัติ & สร้างรูป ({slideRatios.length} รูป)
              </button>
              <button
                onClick={handleGenerateText}
                className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                ↺ สร้างข้อความใหม่
              </button>
              <button
                onClick={() => setPhase("idle")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            เลือก ratio แต่ละรูป แล้วกด &ldquo;อนุมัติ&rdquo; เพื่อให้ AI สร้างรูป {slideRatios.length} รูป
          </p>
        </div>
      )}

      {/* ═══ Phase: Generating Text (loading) ═══ */}
      {phase === "generating_text" && (
        <div className="rounded-lg border border-border bg-card p-10 text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          </div>
          <p className="text-sm font-medium text-foreground">AI กำลังเขียน Caption & Hashtags…</p>
          <p className="text-[10px] text-muted-foreground">ใช้เวลาไม่นาน ~5-10 วินาที</p>
        </div>
      )}

      {/* ═══ Phase: Generating Images (progress) ═══ */}
      {phase === "generating_images" && (
        <div className="rounded-lg border border-border bg-card p-10 text-center space-y-4">
          <p className="text-sm font-medium text-foreground">{statusText}</p>
          <div className="max-w-xs mx-auto space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>กำลัง generate รูป…</span>
              <span className="font-mono">{completedCount}/{slideCount}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-700 ease-out"
                style={{ width: `${slideCount > 0 ? Math.round((completedCount / slideCount) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-2">
            {Array.from({ length: slideCount }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-14 h-14 rounded-md border flex items-center justify-center text-[10px] font-mono transition-all duration-500",
                  completedCount > i
                    ? "border-green-400 bg-green-50 text-green-600"
                    : "border-border animate-pulse bg-secondary text-muted-foreground"
                )}
              >
                {completedCount > i ? "✓" : `S${i + 1}`}
              </div>
            ))}
          </div>

          {caption && (
            <div className="mt-4 text-left rounded-md border border-border bg-secondary/50 p-3">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Caption (อนุมัติแล้ว)</p>
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed line-clamp-4">{caption}</pre>
            </div>
          )}
        </div>
      )}

      {/* ═══ Phase: Idle — initial state ═══ */}
      {phase === "idle" && (
        <div className="rounded-lg border border-border bg-card p-10 text-center space-y-3">
          <p className="text-2xl">◑</p>
          <p className="text-sm font-medium text-foreground">รอ Generate</p>
          <p className="text-xs text-muted-foreground">
            Step 1: AI เขียน caption + hashtags → Step 2: ตรวจสอบ & แก้ไข → Step 3: สร้างรูป {slideCount} สไลด์
          </p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              onClick={handleGenerateText}
              className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-card hover:opacity-80 transition-opacity"
            >
              ▶ เริ่ม Generate
            </button>
            <button
              onClick={handleStartEdit}
              className="rounded-md border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              แก้ไข
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">AI เขียนข้อความ ~10 วิ · สร้างรูป ~2-3 นาที</p>
        </div>
      )}

      {/* ═══ Phase: Done but no slides ═══ */}
      {phase === "done" && slides.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-10 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">ยังไม่มีรูป</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              onClick={handleGenerateText}
              className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-card hover:opacity-80 transition-opacity"
            >
              ▶ เริ่ม Generate
            </button>
            <button
              onClick={handleStartEdit}
              className="rounded-md border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              แก้ไข
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}

      {/* ── Bottom: Delete (only when not in done with action bar) ── */}
      {phase !== "done" && phase !== "editing" && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-40"
          >
            {deleting ? "กำลังลบ…" : "ลบ Campaign นี้"}
          </button>
        </div>
      )}
    </div>
  );
}
