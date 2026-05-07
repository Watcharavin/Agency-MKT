"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Brand, Product } from "@/db/schema";

// ── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "Instagram", label: "Instagram", icon: "IG" },
  { id: "Facebook",  label: "Facebook",  icon: "FB" },
  { id: "TikTok",    label: "TikTok",    icon: "TK" },
  { id: "LINE",      label: "LINE OA",   icon: "LN" },
];

const PLATFORM_RATIOS: Record<string, { ratios: string[]; default: string }> = {
  Instagram: { ratios: ["1:1", "4:5", "9:16"], default: "1:1" },
  Facebook:  { ratios: ["16:9", "1:1", "4:5"], default: "16:9" },
  TikTok:    { ratios: ["9:16", "1:1"],        default: "9:16" },
  LINE:      { ratios: ["1:1", "16:9"],        default: "1:1" },
};

const PILLARS = [
  { id: "Knowledge", label: "Knowledge", desc: "สอน / Tips / อธิบาย" },
  { id: "Product",   label: "Product",   desc: "Features / รีวิว" },
  { id: "Brand",     label: "Brand",     desc: "เรื่องราว / ค่านิยม" },
  { id: "Promotion", label: "Promotion", desc: "ส่วนลด / Urgency" },
  { id: "Others",    label: "Others",    desc: "อื่นๆ" },
];

const GOALS = [
  { id: "Awareness",  label: "Awareness",  desc: "ให้คนรู้จักแบรนด์" },
  { id: "Engagement", label: "Engagement", desc: "like / comment / share" },
  { id: "Conversion", label: "Conversion", desc: "ให้ซื้อ / ลงทะเบียน" },
  { id: "Retention",  label: "Retention",  desc: "ลูกค้าเก่า / Loyalty" },
];

const CTAS     = ["DM เลย", "Link in bio", "Comment ด้านล่าง", "Save ไว้เลย", "ลองเลย", "ไม่ระบุ"];
const TONES    = ["Educational", "Inspirational", "Promotional", "Casual", "Urgent", "Elegant"];
const LANGUAGES = ["TH", "EN", "TH + EN"];
const SLIDE_COUNTS = [1, 2, 3, 4, 5];

const CAPTION_LENGTHS = [
  { id: "Short",  label: "Short",  desc: "< 50 คำ" },
  { id: "Medium", label: "Medium", desc: "50–150 คำ" },
  { id: "Long",   label: "Long",   desc: "150+ คำ" },
];

const FOOTER_STYLES = [
  { id: "Full",    label: "Full",   desc: "ทุกช่องทาง" },
  { id: "Shopee",  label: "Shopee", desc: "Shopee + LINE" },
  { id: "LINE",    label: "LINE",   desc: "LINE only" },
  { id: "Minimal", label: "Min",    desc: "แค่ hashtags" },
  { id: "None",    label: "ไม่ใส่", desc: "ไม่มี footer" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function NewPlatformCampaignForm({
  brand,
  products,
}: {
  brand: Brand | null;
  products: Product[];
}) {
  const router = useRouter();
  const [saving,     setSaving]     = useState(false);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [suggested,  setSuggested]  = useState<string[]>([]);

  // Auto-fill from Brand DNA
  const defaultTone = (brand?.toneTags as string[] | undefined)?.[0] ?? "Educational";
  const defaultLang = (brand?.languages as string[] | undefined)?.[0] ?? "TH";

  const [platform,      setPlatform]      = useState("Instagram");
  const [pillar,        setPillar]        = useState("");
  const [goal,          setGoal]          = useState("");
  const [topic,         setTopic]         = useState("");
  const [productId,     setProductId]     = useState("");
  const [brief,         setBrief]         = useState("");
  const [audience,      setAudience]      = useState(brand?.audience ?? "");
  const [tone,          setTone]          = useState(defaultTone);
  const [language,      setLanguage]      = useState(defaultLang);
  const [cta,           setCta]           = useState("ไม่ระบุ");
  const [captionLength, setCaptionLength] = useState("Medium");
  const [slideCount,    setSlideCount]    = useState(3);
  const [imageRatio,    setImageRatio]    = useState("1:1");
  const [footerStyle,   setFooterStyle]   = useState("Full");

  function handlePlatformChange(p: string) {
    setPlatform(p);
    setImageRatio(PLATFORM_RATIOS[p].default);
  }

  async function handleSuggestTopic() {
    setAiLoading(true);
    setSuggested([]);
    try {
      const res = await fetch("/api/campaigns/suggest-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, pillar, goal, productId: productId || null }),
      });
      const data = await res.json();
      if (res.ok && data.topics) setSuggested(data.topics);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit() {
    if (!topic.trim() || !pillar || !goal) return;
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: platform, topic: topic.trim(),
          productId: productId || null,
          brief: brief.trim() || null,
          audience: audience.trim() || null,
          tone, language, slideCount, imageRatio,
          pillar, goal, cta, captionLength, footerStyle,
        }),
      });
      const data = await res.json();
      if (res.ok) router.push(`/campaigns/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  const canGenerate = !!topic.trim() && !!pillar && !!goal;
  const ratios = PLATFORM_RATIOS[platform].ratios;

  return (
    <div className="flex gap-5 items-start">

      {/* ── Left ── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* 1. Platform */}
        <Section title="1. Platform" desc="เลือก platform ที่จะโพสต์">
          <div className="grid grid-cols-4 gap-2">
            {PLATFORMS.map((p) => (
              <button key={p.id} type="button" onClick={() => handlePlatformChange(p.id)}
                className={cn("rounded-lg border p-3 text-left transition-all",
                  platform === p.id ? "border-foreground bg-foreground text-card" : "border-border bg-background hover:border-foreground/40"
                )}>
                <p className={cn("text-xs font-mono font-bold", platform === p.id ? "text-card/60" : "text-muted-foreground")}>{p.icon}</p>
                <p className={cn("text-sm font-medium mt-0.5", platform === p.id ? "text-card" : "text-foreground")}>{p.label}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* 2. Pillar + Goal */}
        <Section title="2. Pillar & Goal" desc="ประเภท content และเป้าหมายของโพสต์">
          <Field label="Content Pillar" required>
            <div className="grid grid-cols-5 gap-2">
              {PILLARS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPillar(p.id)}
                  className={cn("rounded-lg border p-2.5 text-left transition-all",
                    pillar === p.id ? "border-foreground bg-foreground" : "border-border bg-background hover:border-foreground/40"
                  )}>
                  <p className={cn("text-xs font-semibold", pillar === p.id ? "text-card" : "text-foreground")}>{p.label}</p>
                  <p className={cn("text-[10px] mt-0.5 leading-tight", pillar === p.id ? "text-card/60" : "text-muted-foreground")}>{p.desc}</p>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Goal" required>
            <div className="grid grid-cols-4 gap-2">
              {GOALS.map((g) => (
                <button key={g.id} type="button" onClick={() => setGoal(g.id)}
                  className={cn("rounded-lg border p-2.5 text-left transition-all",
                    goal === g.id ? "border-foreground bg-foreground" : "border-border bg-background hover:border-foreground/40"
                  )}>
                  <p className={cn("text-xs font-semibold", goal === g.id ? "text-card" : "text-foreground")}>{g.label}</p>
                  <p className={cn("text-[10px] mt-0.5", goal === g.id ? "text-card/60" : "text-muted-foreground")}>{g.desc}</p>
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* 3. Topic */}
        <Section title="3. Topic & Product" desc="หัวข้อโพสต์และสินค้าที่ต้องการโปรโมท">
          <Field label="หัวข้อโพสต์" required>
            <div className="flex gap-2">
              <input value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="เช่น แนะนำ Vitamin C Serum สำหรับผิวหมองคล้ำ"
                className={cn(inputCls, "flex-1")} />
              <button type="button" onClick={handleSuggestTopic} disabled={aiLoading}
                className="shrink-0 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                {aiLoading
                  ? <span className="h-3 w-3 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                  : "✨"}
                AI แนะนำ
              </button>
            </div>
            {suggested.length > 0 && (
              <div className="mt-2 rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">เลือก topic ที่ชอบ</p>
                {suggested.map((t, i) => (
                  <button key={i} type="button"
                    onClick={() => { setTopic(t); setSuggested([]); }}
                    className="w-full text-left rounded-md px-3 py-2 text-xs text-foreground hover:bg-background transition-colors border border-transparent hover:border-border">
                    {t}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <Field label="สินค้าหลัก" hint="AI จะใช้รูปและข้อมูลสินค้านี้">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
              <option value="">— ไม่ระบุสินค้า —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Brief เพิ่มเติม">
            <textarea rows={2} value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder="รายละเอียดให้ AI สร้าง content ได้ตรงจุด" className={inputCls} />
          </Field>
        </Section>

        {/* 4. Caption */}
        <Section title="4. Caption" desc="กำหนดรูปแบบ caption">
          <div className="grid grid-cols-2 gap-4">
            <Field label="กลุ่มเป้าหมาย" hint="auto-fill จาก Brand DNA — แก้ได้">
              <input value={audience} onChange={(e) => setAudience(e.target.value)}
                placeholder="เช่น ผู้หญิง 25-35 ปี" className={inputCls} />
            </Field>
            <Field label="Tone">
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button key={t} type="button" onClick={() => setTone(t)}
                    className={cn("rounded-full px-3 py-1 text-xs transition-colors",
                      tone === t ? "bg-foreground text-card" : "bg-secondary text-foreground hover:bg-border")}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CTA">
              <div className="flex flex-wrap gap-1.5">
                {CTAS.map((c) => (
                  <button key={c} type="button" onClick={() => setCta(c)}
                    className={cn("rounded-full px-3 py-1 text-xs transition-colors",
                      cta === c ? "bg-foreground text-card" : "bg-secondary text-foreground hover:bg-border")}>
                    {c}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Caption Length">
              <div className="flex gap-2">
                {CAPTION_LENGTHS.map((cl) => (
                  <button key={cl.id} type="button" onClick={() => setCaptionLength(cl.id)}
                    className={cn("flex-1 rounded-lg border p-2 text-center transition-all",
                      captionLength === cl.id ? "border-foreground bg-foreground" : "border-border bg-background hover:border-foreground/40")}>
                    <p className={cn("text-xs font-semibold", captionLength === cl.id ? "text-card" : "text-foreground")}>{cl.label}</p>
                    <p className={cn("text-[10px]", captionLength === cl.id ? "text-card/60" : "text-muted-foreground")}>{cl.desc}</p>
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ภาษา">
              <div className="flex gap-2">
                {LANGUAGES.map((l) => (
                  <button key={l} type="button" onClick={() => setLanguage(l)}
                    className={cn("flex-1 rounded-md border px-3 py-1.5 text-xs font-mono transition-colors",
                      language === l ? "border-foreground bg-foreground text-card" : "border-border bg-background text-foreground hover:bg-secondary")}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Footer" hint="ดึงลิงก์จาก Brand DNA">
              <div className="flex flex-wrap gap-1.5">
                {FOOTER_STYLES.map((f) => (
                  <button key={f.id} type="button" onClick={() => setFooterStyle(f.id)}
                    className={cn("rounded-full px-3 py-1 text-xs transition-colors",
                      footerStyle === f.id ? "bg-foreground text-card" : "bg-secondary text-foreground hover:bg-border")}>
                    {f.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Section>

        {/* 5. Images */}
        <Section title="5. Images" desc="จำนวนและ ratio ของรูป">
          <div className="grid grid-cols-2 gap-6">
            <Field label="จำนวน Slides">
              <div className="flex gap-2">
                {SLIDE_COUNTS.map((n) => (
                  <button key={n} type="button" onClick={() => setSlideCount(n)}
                    className={cn("w-11 h-11 rounded-lg border text-sm font-medium transition-all",
                      slideCount === n ? "border-foreground bg-foreground text-card" : "border-border bg-background text-foreground hover:border-foreground/40")}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Image Ratio" hint={`Default ของ ${platform}`}>
              <div className="flex gap-2 flex-wrap">
                {ratios.map((r) => (
                  <button key={r} type="button" onClick={() => setImageRatio(r)}
                    className={cn("rounded-lg border px-3 py-2 text-xs font-mono transition-all",
                      imageRatio === r ? "border-foreground bg-foreground text-card" : "border-border bg-background text-foreground hover:border-foreground/40")}>
                    {r}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Section>

      </div>

      {/* ── Right: summary ── */}
      <div className="w-64 shrink-0">
        <div className="rounded-lg border border-border bg-card p-5 sticky top-6 space-y-4">
          <div className="pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Summary</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Review ก่อน generate</p>
          </div>
          <div className="space-y-2 text-xs">
            <SRow label="Platform"  value={platform} />
            <SRow label="Pillar"    value={pillar    || "—"} warn={!pillar} />
            <SRow label="Goal"      value={goal      || "—"} warn={!goal} />
            <SRow label="Ratio"     value={imageRatio} />
            <SRow label="Slides"    value={`${slideCount} slides`} />
            <SRow label="Caption"   value={captionLength} />
            <SRow label="CTA"       value={cta} />
            <SRow label="Footer"    value={footerStyle} />
            <SRow label="ภาษา"      value={language} />
            <SRow label="Brand DNA" value={brand?.name ?? "—"} />
            <div className="pt-2 border-t border-border">
              <SRow label="Output" value={`${slideCount} รูป + caption`} bold />
            </div>
          </div>
          {!canGenerate && (
            <p className="text-[10px] text-muted-foreground text-center bg-secondary rounded-md p-2">
              เลือก Pillar + Goal และใส่ Topic
            </p>
          )}
          <button onClick={handleSubmit} disabled={!canGenerate || saving}
            className="w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-card hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2">
            {saving
              ? <><span className="h-3 w-3 rounded-full border-2 border-card/30 border-t-card animate-spin" />กำลังสร้าง…</>
              : <>▶ Generate Content</>}
          </button>
          <p className="text-[10px] text-muted-foreground text-center -mt-2">~45 วินาที · บันทึกอัตโนมัติ</p>
        </div>
      </div>

    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function SRow({ label, value, bold, warn }: { label: string; value: string; bold?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", bold && "font-semibold text-foreground", warn ? "text-orange-400" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/50 focus:border-foreground/40 focus:outline-none focus:ring-1 " +
  "focus:ring-foreground/10 transition-colors resize-none";
