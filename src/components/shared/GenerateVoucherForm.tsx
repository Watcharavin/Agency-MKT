"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Brand, VoucherCollection } from "@/db/schema";

type VoucherWithCount = VoucherCollection & { couponCount: number };

const TONE_OPTIONS = ["Warm", "Refined", "Playful", "Bold", "Urgent", "Elegant"];

export function GenerateVoucherForm({
  brand,
  vouchers,
}: {
  brand: Brand | null;
  vouchers: VoucherWithCount[];
}) {
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(vouchers[0]?.id ?? null);
  const [selectedTones, setSelectedTones] = useState<string[]>(["Warm"]);
  const [prompt, setPrompt] = useState("");
  const [slogan, setSlogan] = useState("");
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const router = useRouter();

  const selectedVoucher = vouchers.find((v) => v.id === selectedVoucherId) ?? null;
  const couponCount = selectedVoucher?.couponCount ?? 0;
  const totalImages = couponCount + 2;

  function toggleTone(t: string) {
    setSelectedTones((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  async function handleRun() {
    if (!selectedVoucher) return;
    setRunning(true);
    setError(null);
    setStatusText("กำลังสร้าง tasks…");
    setCompletedCount(0);

    try {
      // Step 1: Start generation tasks
      const startRes = await fetch("/api/generate/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherId: selectedVoucher.id,
          prompt,
          tones: selectedTones,
          slogan,
        }),
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error ?? "Failed to start generation");
      }

      const { tasks } = await startRes.json() as {
        tasks: Array<{ label: string; couponId?: string; taskId: string }>;
        voucherId: string;
      };

      setStatusText(`รอผล ${tasks.length} รูป…`);

      // Step 2: Poll ALL tasks in parallel (max 3 min each)
      const MAX_POLLS = 60; // 60 × 3s = 3 min
      const POLL_INTERVAL = 3000;

      async function pollTask(task: { label: string; couponId?: string; taskId: string }) {
        for (let i = 0; i < MAX_POLLS; i++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL));
          try {
            const pollRes = await fetch(`/api/generate/status/${task.taskId}`);
            if (!pollRes.ok) continue;
            const { status, imageUrl } = await pollRes.json();
            if (status === "completed") {
              setCompletedCount((prev) => prev + 1);
              return { ...task, imageUrl: imageUrl ?? null };
            }
            if (status === "failed") {
              setCompletedCount((prev) => prev + 1);
              return { ...task, imageUrl: null };
            }
          } catch {
            // network hiccup — retry
          }
        }
        setCompletedCount((prev) => prev + 1);
        return { ...task, imageUrl: null }; // timeout
      }

      const settled = await Promise.all(tasks.map(pollTask));
      const results = settled.filter((r) => r.imageUrl !== null) as Array<{
        label: string; couponId?: string; taskId: string; imageUrl: string;
      }>;

      setStatusText("บันทึกรูปลง database…");

      // Step 3: Save image URLs to DB
      if (results.length > 0) {
        await fetch(`/api/vouchers/${selectedVoucher.id}/save-images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: results }),
        });
      }

      setStatusText("เสร็จแล้ว! กำลัง redirect…");
      router.push(`/vouchers/${selectedVoucher.id}/result`);
    } catch (err) {
      setError(String(err));
      setRunning(false);
      setStatusText("");
    }
  }

  return (
    <div className="flex flex-col gap-0 -mt-1">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
        <Link href="/super-aff" className="hover:text-foreground transition-colors">Super AFF</Link>
        <span>/</span>
        <span className="text-foreground">Generate Images</span>
      </div>

      {/* Title */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">New Voucher — Generate</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI สร้างรูปครบชุด: voucher cover + collection + coupon แต่ละใบ
          </p>
        </div>
        <span className="rounded-full border border-primary px-3 py-1 text-[11px] font-mono font-medium tracking-widest text-primary uppercase">
          Super AFF
        </span>
      </div>

      <div className="flex gap-5 items-start">

        {/* Left */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Voucher picker */}
          <Section title="เลือก Voucher" desc="เลือก voucher ที่สร้างไว้แล้วใน Super AFF">
            {vouchers.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <p className="text-sm text-foreground font-medium">ยังไม่มี Voucher</p>
                <p className="text-xs text-muted-foreground mt-1">สร้าง Voucher ก่อนใน Super AFF</p>
                <Link
                  href="/super-aff/new"
                  className="mt-4 inline-block rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  + Create Voucher
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {vouchers.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVoucherId(v.id)}
                    className={cn(
                      "rounded-lg border overflow-hidden text-left transition-all",
                      selectedVoucherId === v.id
                        ? "border-foreground ring-1 ring-foreground"
                        : "border-border hover:border-foreground/40"
                    )}
                  >
                    <div className="h-28 w-full relative" style={{ background: "repeating-linear-gradient(45deg, #e8e3d8, #e8e3d8 12px, #f0ece4 12px, #f0ece4 24px)" }}>
                      <span className="absolute inset-0 flex items-end justify-center pb-2 text-[10px] font-mono text-foreground/40">
                        {v.name}
                      </span>
                    </div>
                    <div className="px-3 py-2 bg-card">
                      <p className="text-xs font-medium text-foreground truncate">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {v.couponCount} coupon{v.couponCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* Brief */}
          {selectedVoucher && (
            <Section title="Brief" desc="คำแนะนำให้ AI สร้างรูปตามที่ต้องการ">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Text prompt</label>
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="อธิบาย mood & tone รูปที่ต้องการ เช่น minimal สีครีม warm tone..."
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Tone</label>
                    <div className="flex flex-wrap gap-1.5">
                      {TONE_OPTIONS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTone(t)}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs transition-colors",
                            selectedTones.includes(t)
                              ? "bg-foreground text-card"
                              : "bg-secondary text-foreground hover:bg-border"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Slogan</label>
                    <input
                      value={slogan}
                      onChange={(e) => setSlogan(e.target.value)}
                      placeholder="เช่น ดีลพิเศษเฉพาะคุณ"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Output preview */}
          {selectedVoucher && (
            <Section title="Output" badge={`${totalImages} รูป · 1:1`} desc="AI สร้างรูปทั้งหมดนี้ให้อัตโนมัติ">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <PreviewTile label="VOUCHER" sub="cover" accent running={running} completed={running && completedCount > 0} />
                <PreviewTile label="COLLECTION" sub="merged" accent running={running} completed={running && completedCount > 1} />
                {Array.from({ length: couponCount }).map((_, i) => (
                  <PreviewTile key={i} label={`coupon ${i + 1}`} running={running} completed={running && completedCount > i + 2} />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                ↳ {couponCount} coupon · scales อัตโนมัติตาม coupon ที่มีใน voucher
              </p>
            </Section>
          )}
        </div>

        {/* Right: Generation panel */}
        <div className="w-64 shrink-0">
          <div className="rounded-lg border border-border bg-card p-5 sticky top-6 space-y-4">
            <div className="pb-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Generation</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Review แล้ว run AI</p>
            </div>

            <div className="space-y-2 text-xs">
              <Row label="Target" value="Super AFF" />
              <Row label="Voucher" value={selectedVoucher?.name ?? "—"} />
              <Row label="Voucher cover" value={selectedVoucher ? "1 รูป" : "—"} />
              <Row label="Collection" value={selectedVoucher ? "1 merged" : "—"} />
              <Row label="Coupons" value={selectedVoucher ? `${couponCount} รูป` : "—"} />
              <div className="pt-2 border-t border-border">
                <Row label="รวม" value={selectedVoucher ? `${totalImages} รูป` : "—"} bold />
              </div>
              <Row label="Format" value="1:1 · 1080×1080" />
              <Row label="Brand DNA" value={brand ? brand.name : "—"} />
            </div>

            {running && selectedVoucher && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {completedCount < totalImages ? "กำลัง generate…" : "เสร็จแล้ว"}
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-foreground">
                    {completedCount}/{totalImages}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${totalImages > 0 ? Math.round((completedCount / totalImages) * 100) : 0}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleRun}
              disabled={!selectedVoucher || running}
              className="w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-card hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
            >
              {running ? (
                <>
                  <span className="h-3 w-3 rounded-full border-2 border-card/30 border-t-card animate-spin" />
                  กำลัง generate…
                </>
              ) : (
                <>▶ Run AI</>
              )}
            </button>

            {statusText && (
              <p className="text-[10px] text-muted-foreground text-center -mt-2">{statusText}</p>
            )}
            {!statusText && !running && (
              <p className="text-[10px] text-muted-foreground text-center -mt-2">
                ~2–3 นาที · บันทึกอัตโนมัติ
              </p>
            )}
            {error && (
              <p className="text-[10px] text-red-500 text-center rounded-md bg-red-50 px-2 py-1">
                {error}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, desc, badge, children }: { title: string; desc: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="pb-3 border-b border-border flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        {badge && (
          <span className="rounded-full border border-primary px-2 py-0.5 text-[10px] font-mono tracking-wider text-primary uppercase shrink-0 ml-3">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground text-right", bold && "font-semibold")}>{value}</span>
    </div>
  );
}

function PreviewTile({
  label, sub, accent, running, completed,
}: {
  label: string; sub?: string; accent?: boolean; running?: boolean; completed?: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 w-20 h-20 rounded-md border flex flex-col items-center justify-center gap-0.5 text-center relative overflow-hidden transition-all duration-500",
        completed
          ? "border-green-400 bg-green-50"
          : accent
          ? "border-primary bg-primary/10"
          : "border-border",
        running && !completed ? "animate-pulse" : ""
      )}
      style={!accent && !completed ? { background: "repeating-linear-gradient(45deg, #e8e3d8, #e8e3d8 8px, #f0ece4 8px, #f0ece4 16px)" } : undefined}
    >
      {completed ? (
        <span className="text-green-500 text-xl leading-none">✓</span>
      ) : (
        <>
          <span className={cn("text-[10px] font-mono font-semibold uppercase tracking-wide", accent ? "text-primary" : "text-foreground/40")}>
            {label}
          </span>
          {sub && (
            <span className={cn("text-[9px] font-mono", accent ? "text-primary/70" : "text-foreground/30")}>
              {sub}
            </span>
          )}
        </>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/50 focus:border-foreground/40 focus:outline-none focus:ring-1 " +
  "focus:ring-foreground/10 transition-colors resize-none";
