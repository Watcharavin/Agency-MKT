"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Brand, Product } from "@/db/schema";

const CHANNELS = [
  { id: "Facebook",  label: "Facebook",  spec: "1200×628 · Landscape" },
  { id: "Instagram", label: "Instagram", spec: "1080×1080 · Square" },
  { id: "LINE",      label: "LINE OA",   spec: "1040×1040 · Square" },
  { id: "TikTok",    label: "TikTok",    spec: "1080×1920 · Vertical" },
];

const TONES = ["Educational", "Inspirational", "Promotional", "Casual", "Urgent", "Elegant"];
const LANGUAGES = ["TH", "EN", "TH + EN"];
const SLIDE_COUNTS = [1, 2, 3, 4, 5];

export function NewPlatformCampaignForm({
  brand,
  products,
}: {
  brand: Brand | null;
  products: Product[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [channel, setChannel] = useState("Instagram");
  const [topic, setTopic] = useState("");
  const [productId, setProductId] = useState("");
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Educational");
  const [language, setLanguage] = useState("TH");
  const [slideCount, setSlideCount] = useState(3);

  const selectedChannel = CHANNELS.find((c) => c.id === channel)!;

  async function handleSubmit() {
    if (!topic.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          topic: topic.trim(),
          productId: productId || null,
          brief: brief.trim() || null,
          audience: audience.trim() || null,
          tone,
          language,
          slideCount,
        }),
      });
      const data = await res.json();
      if (res.ok) router.push(`/campaigns/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-5 items-start">

      {/* ── Left: form ── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Channel selector */}
        <Section title="Channel" desc="เลือก platform ที่จะโพสต์">
          <div className="grid grid-cols-4 gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  channel === ch.id
                    ? "border-foreground bg-foreground text-card"
                    : "border-border bg-background hover:border-foreground/40"
                )}
              >
                <p className={cn("text-sm font-medium", channel === ch.id ? "text-card" : "text-foreground")}>
                  {ch.label}
                </p>
                <p className={cn("text-[10px] font-mono mt-0.5", channel === ch.id ? "text-card/60" : "text-muted-foreground")}>
                  {ch.spec}
                </p>
              </button>
            ))}
          </div>
        </Section>

        {/* Topic & Product */}
        <Section title="Topic & Product" desc="หัวข้อโพสต์และสินค้าหลักที่ต้องการโปรโมท">
          <Field label="หัวข้อโพสต์" required>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="เช่น แนะนำ Vitamin C Serum สำหรับผิวหมองคล้ำ"
              className={inputCls}
            />
          </Field>
          <Field label="สินค้าหลัก" hint="AI จะใช้รูปและข้อมูลสินค้านี้">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
              <option value="">— ไม่ระบุสินค้า —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
        </Section>

        {/* Brief */}
        <Section title="Brief" desc="รายละเอียดเพิ่มเติมให้ AI สร้าง content ได้ตรงจุด">
          <Field label="โพสต์นี้เกี่ยวกับอะไร">
            <textarea
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="เช่น ต้องการโปรโมท serum ตัวใหม่ เน้นผลลัพธ์ใน 7 วัน กลุ่มเป้าหมายเป็นผู้หญิง 25-35 ปี"
              className={inputCls}
            />
          </Field>
          <Field label="กลุ่มเป้าหมาย">
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="เช่น ผู้หญิง 25-35 ปี ที่ดูแลผิว"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tone">
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs transition-colors",
                      tone === t ? "bg-foreground text-card" : "bg-secondary text-foreground hover:bg-border"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="ภาษา">
              <div className="flex flex-col gap-1.5">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguage(l)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-mono transition-colors text-left",
                      language === l ? "border-foreground bg-foreground text-card" : "border-border bg-background text-foreground hover:bg-secondary"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Section>

        {/* Carousel slides */}
        <Section title="Carousel Slides" desc="จำนวนสไลด์ที่ต้องการ (1–5)">
          <div className="flex gap-2">
            {SLIDE_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSlideCount(n)}
                className={cn(
                  "w-12 h-12 rounded-lg border text-sm font-medium transition-all",
                  slideCount === n ? "border-foreground bg-foreground text-card" : "border-border bg-background text-foreground hover:border-foreground/40"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            AI จะสร้าง {slideCount} สไลด์ · {selectedChannel.spec}
          </p>
        </Section>
      </div>

      {/* ── Right: summary panel ── */}
      <div className="w-64 shrink-0">
        <div className="rounded-lg border border-border bg-card p-5 sticky top-6 space-y-4">
          <div className="pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Summary</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Review ก่อน generate</p>
          </div>

          <div className="space-y-2 text-xs">
            <Row label="Channel" value={selectedChannel.label} />
            <Row label="Format" value={selectedChannel.spec} />
            <Row label="Slides" value={`${slideCount} สไลด์`} />
            <Row label="Tone" value={tone} />
            <Row label="ภาษา" value={language} />
            <Row label="Brand DNA" value={brand?.name ?? "—"} />
            <div className="pt-2 border-t border-border">
              <Row label="Output" value={`${slideCount} รูป + caption + hashtags`} bold />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!topic.trim() || saving}
            className="w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-card hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 border-card/30 border-t-card animate-spin" />
                กำลังสร้าง…
              </>
            ) : (
              <>▶ Generate Content</>
            )}
          </button>
          <p className="text-[10px] text-muted-foreground text-center -mt-2">
            ~45 วินาที · บันทึกอัตโนมัติ
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="pb-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-foreground">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
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

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/50 focus:border-foreground/40 focus:outline-none focus:ring-1 " +
  "focus:ring-foreground/10 transition-colors resize-none";
