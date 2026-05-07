"use client";

import { useState, useRef } from "react";
import type { Brand } from "@/db/schema";
import { cn } from "@/lib/utils";

const TONE_OPTIONS = [
  "เป็นกันเอง", "มืออาชีพ", "สนุก", "หรูหรา",
  "น่าเชื่อถือ", "ตลกขบขัน", "อบอุ่น", "ตรงไปตรงมา",
];

const CHANNEL_OPTIONS = ["Facebook", "Instagram", "LINE", "TikTok"];
const LANGUAGE_OPTIONS = ["TH", "EN", "ZH", "JA", "KO", "MY"];

const FONT_OPTIONS = [
  "Inter", "Sarabun", "Prompt", "Kanit",
  "Noto Serif", "Georgia", "Playfair Display", "DM Sans",
];

type ColorKey = "primaryColor" | "secondaryColor" | "thirdColor";

const COLOR_META: { key: ColorKey; label: string }[] = [
  { key: "primaryColor",   label: "Primary"   },
  { key: "secondaryColor", label: "Secondary" },
  { key: "thirdColor",     label: "Accent"    },
];

export function BrandDNAForm({ initialData }: { initialData: Brand | null }) {
  const d = initialData;
  const formRef    = useRef<HTMLFormElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [logoUrl,      setLogoUrl]      = useState<string>(d?.logoUrl ?? "");
  const [logoPreview,  setLogoPreview]  = useState<string>(
    d?.logoUrl ? `/api/blob?url=${encodeURIComponent(d.logoUrl)}` : ""
  );
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError,    setLogoError]    = useState<string | null>(null);
  const [selectedTones,     setSelectedTones]     = useState<string[]>(d?.toneTags    ?? []);
  const [selectedChannels,  setSelectedChannels]  = useState<string[]>(d?.channels   ?? []);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(d?.languages  ?? ["TH"]);
  const [colors, setColors] = useState<Record<ColorKey, string>>({
    primaryColor:   d?.primaryColor   ?? "#c8a882",
    secondaryColor: d?.secondaryColor ?? "#e2ddcf",
    thirdColor:     d?.thirdColor     ?? "#1a1916",
  });

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED_LOGO = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!ALLOWED_LOGO.includes(file.type)) {
      setLogoError(`ไฟล์ไม่รองรับ (${file.type}) — ใช้ได้เฉพาะ JPG, PNG, WEBP`);
      e.target.value = "";
      return;
    }

    const MAX_MB = 4;
    if (file.size > MAX_MB * 1024 * 1024) {
      setLogoError(`ไฟล์ใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(1)} MB) — สูงสุด ${MAX_MB} MB`);
      e.target.value = "";
      return;
    }

    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    setLogoError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/brand/logo", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setLogoUrl(url);
    } catch {
      setLogoError("อัปโหลดโลโก้ไม่สำเร็จ กรุณาลองใหม่");
      setLogoPreview(d?.logoUrl ? `/api/blob?url=${encodeURIComponent(d.logoUrl)}` : "");
      setLogoUrl(d?.logoUrl ?? "");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  function toggle(arr: string[], set: (v: string[]) => void, item: string) {
    set(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  }

  function handleDiscard() {
    formRef.current?.reset();
    setSelectedTones(d?.toneTags    ?? []);
    setSelectedChannels(d?.channels ?? []);
    setSelectedLanguages(d?.languages ?? ["TH"]);
    setColors({
      primaryColor:   d?.primaryColor   ?? "#c8a882",
      secondaryColor: d?.secondaryColor ?? "#e2ddcf",
      thirdColor:     d?.thirdColor     ?? "#1a1916",
    });
    setLogoUrl(d?.logoUrl ?? "");
    setLogoPreview(d?.logoUrl ? `/api/blob?url=${encodeURIComponent(d.logoUrl)}` : "");
    setLogoError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name:         fd.get("name"),
      tagline:      fd.get("tagline"),
      about:        fd.get("about"),
      audience:     fd.get("audience"),
      doSay:        fd.get("doSay"),
      dontSay:      fd.get("dontSay"),
      displayFont:  fd.get("displayFont"),
      bodyFont:     fd.get("bodyFont"),
      ...colors,
      logoUrl:   logoUrl || null,
      toneTags:  selectedTones,
      channels:  selectedChannels,
      languages: selectedLanguages,
    };
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Workspace</p>
          <h1 className="text-xl font-semibold text-foreground mt-0.5">Brand DNA</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI ใช้ข้อมูลนี้ในทุก Content — ยิ่งละเอียด ยิ่งตรงแบรนด์
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-muted-foreground">บันทึกแล้ว ✓</span>
          )}
          <button
            type="button"
            onClick={handleDiscard}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground/70 hover:bg-secondary transition-colors"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* ── 2-column card grid ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* ── Card 1: Identity ── */}
        <Card title="Identity" desc="ชื่อ แนวคิด และเรื่องราวของแบรนด์">
          <Field label="Brand name" required>
            <input
              name="name"
              required
              defaultValue={d?.name ?? ""}
              placeholder="เช่น Trusme Cosmetics"
              className={inputCls}
            />
          </Field>
          <Field label="Tagline">
            <input
              name="tagline"
              defaultValue={d?.tagline ?? ""}
              placeholder="เช่น ผิวดีมีได้ทุกวัน"
              className={inputCls}
            />
          </Field>
          <Field label="About" hint="บอก AI ว่าแบรนด์ทำอะไร มีจุดเด่นอะไร">
            <textarea
              name="about"
              rows={5}
              defaultValue={d?.about ?? ""}
              placeholder="เช่น แบรนด์ Skincare สำหรับคนไทย เน้นส่วนผสมธรรมชาติ ราคาเข้าถึงได้..."
              className={inputCls}
            />
          </Field>
        </Card>

        {/* ── Card 2: Visual ── */}
        <Card title="Visual" desc="สีประจำแบรนด์ ฟอนต์ และโลโก้">
          <Field label="Brand colors">
            <div className="flex gap-3 mt-1">
              {COLOR_META.map(({ key, label }) => (
                <div key={key} className="flex-1">
                  <div
                    className="h-12 w-full rounded-md border border-border overflow-hidden relative cursor-pointer"
                    style={{ backgroundColor: colors[key] }}
                  >
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) =>
                        setColors((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1 text-center truncate">
                    {colors[key].toUpperCase()}
                  </p>
                  <p className="text-[10px] text-muted-foreground text-center">{label}</p>
                </div>
              ))}
            </div>
            {/* Color bar preview */}
            <div className="flex h-2 rounded-full overflow-hidden mt-2 gap-px">
              <div className="flex-1 rounded-l-full" style={{ backgroundColor: colors.primaryColor }} />
              <div className="flex-1" style={{ backgroundColor: colors.secondaryColor }} />
              <div className="flex-1 rounded-r-full" style={{ backgroundColor: colors.thirdColor }} />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Display font">
              <select
                name="displayFont"
                defaultValue={d?.displayFont ?? "Inter"}
                className={inputCls}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Body font">
              <select
                name="bodyFont"
                defaultValue={d?.bodyFont ?? "Inter"}
                className={inputCls}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Logo">
            <div
              onClick={() => logoInputRef.current?.click()}
              className="mt-1 relative flex h-24 w-full items-center justify-center rounded-md border border-dashed border-border bg-background text-xs text-muted-foreground cursor-pointer hover:bg-secondary transition-colors overflow-hidden"
            >
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="logo" className="h-full w-full object-contain p-2" />
              ) : (
                <span>+ อัปโหลดโลโก้</span>
              )}
              {logoUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <span className="h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                </div>
              )}
              {logoPreview && !logoUploading && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLogoUrl(""); setLogoPreview(""); }}
                  className="absolute top-1 right-1 rounded-full bg-foreground/80 text-card w-5 h-5 text-xs flex items-center justify-center hover:bg-foreground"
                >
                  ×
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            {logoError && (
              <p className="text-xs text-red-500 mt-1">{logoError}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG, SVG · แนะนำ PNG พื้นหลังโปร่งใส</p>
          </Field>
        </Card>

        {/* ── Card 3: Voice & Tone ── */}
        <Card title="Voice & Tone" desc="บุคลิกและน้ำเสียงของแบรนด์">
          <Field label="โทนเสียง" hint="เลือกได้หลายอัน">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(selectedTones, setSelectedTones, t)}
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
          </Field>

          <Field label="พูดแบบนี้ (Do say)" hint="ตัวอย่างน้ำเสียงที่ต้องการ">
            <textarea
              name="doSay"
              rows={3}
              defaultValue={d?.doSay ?? ""}
              placeholder="เช่น ใช้ภาษาเข้าใจง่าย เป็นกันเอง ให้กำลังใจ..."
              className={inputCls}
            />
          </Field>

          <Field label="อย่าพูดแบบนี้ (Don't say)" hint="สิ่งที่แบรนด์ไม่พูด">
            <textarea
              name="dontSay"
              rows={3}
              defaultValue={d?.dontSay ?? ""}
              placeholder="เช่น อย่าใช้ศัพท์แสง อย่าพูดถึงคู่แข่ง..."
              className={inputCls}
            />
          </Field>
        </Card>

        {/* ── Card 4: Audience ── */}
        <Card title="Audience" desc="กลุ่มเป้าหมายและช่องทาง">
          <Field label="กลุ่มเป้าหมายหลัก">
            <input
              name="audience"
              defaultValue={d?.audience ?? ""}
              placeholder="เช่น ผู้หญิงอายุ 20–35 ชอบดูแลตัวเอง สนใจ Skincare"
              className={inputCls}
            />
          </Field>

          <Field label="ภาษา" hint="ภาษาที่ใช้ใน Content">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {LANGUAGE_OPTIONS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggle(selectedLanguages, setSelectedLanguages, l)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-mono transition-colors",
                    selectedLanguages.includes(l)
                      ? "bg-foreground text-card"
                      : "bg-secondary text-foreground hover:bg-border"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Platform ที่ใช้">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CHANNEL_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(selectedChannels, setSelectedChannels, c)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs transition-colors",
                    selectedChannels.includes(c)
                      ? "bg-foreground text-card"
                      : "bg-secondary text-foreground hover:bg-border"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
        </Card>

      </div>
    </form>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function Card({
  title, desc, children,
}: {
  title: string; desc: string; children: React.ReactNode;
}) {
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

function Field({
  label, hint, required, children,
}: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-foreground">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:outline-none focus:ring-1 " +
  "focus:ring-foreground/10 transition-colors resize-none";
