"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/* ─── Data ─── */
const TONE_OPTIONS = [
  "เป็นกันเอง", "มืออาชีพ", "สนุก", "หรูหรา",
  "น่าเชื่อถือ", "ตลกขบขัน", "อบอุ่น", "ตรงไปตรงมา",
];
const CHANNEL_OPTIONS = [
  { id: "facebook",  label: "Facebook",  icon: "f" },
  { id: "instagram", label: "Instagram", icon: "◎" },
  { id: "line",      label: "LINE",      icon: "L" },
  { id: "tiktok",    label: "TikTok",    icon: "♪" },
];

const STEPS = [
  { title: "แนะนำแบรนด์",    desc: "ชื่อและ slogan ของคุณคืออะไร?" },
  { title: "เกี่ยวกับแบรนด์", desc: "บอก AI ว่าคุณขายอะไร ให้ใคร" },
  { title: "โทนเสียง",        desc: "ต้องการให้ Content ฟังดูแบบไหน?" },
  { title: "Platform & สี",   desc: "ใช้ช่องทางไหน และสีของแบรนด์" },
];

type FormData = {
  name: string;
  tagline: string;
  about: string;
  audience: string;
  toneTags: string[];
  channels: string[];
  primaryColor: string;
  secondaryColor: string;
  thirdColor: string;
};

const INIT: FormData = {
  name: "", tagline: "", about: "", audience: "",
  toneTags: [], channels: [],
  primaryColor: "#7c3aed",
  secondaryColor: "#a78bfa",
  thirdColor: "#1e1b4b",
};

/* ─── Main Component ─── */
export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = STEPS.length;
  const pct = Math.round(((step + 1) / total) * 100);

  function set(key: keyof FormData, val: string) {
    setData((prev) => ({ ...prev, [key]: val }));
  }
  function toggleArr(key: "toneTags" | "channels", val: string) {
    setData((prev) => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });
  }

  function canNext(): boolean {
    if (step === 0) return data.name.trim().length > 0;
    if (step === 1) return data.about.trim().length > 0;
    return true;
  }

  function handleNext() {
    if (!canNext()) { setError("กรุณากรอกข้อมูลที่จำเป็น"); return; }
    setError("");
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
      }
    } catch {
      setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-zinc-400">
            ขั้นตอน {step + 1} / {total}
          </span>
          <span className="text-xs text-violet-400 font-semibold">{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-800">
          <div
            className="h-1.5 rounded-full bg-violet-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex justify-between mt-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  i < step
                    ? "bg-violet-500"
                    : i === step
                    ? "bg-violet-400 ring-2 ring-violet-400/30"
                    : "bg-zinc-700"
                }`}
              />
              <span className={`text-[10px] hidden sm:block ${i === step ? "text-violet-400" : "text-zinc-600"}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">{STEPS[step].title}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{STEPS[step].desc}</p>
      </div>

      {/* Step content */}
      <div className="space-y-4 min-h-[220px]">
        {step === 0 && <Step1 data={data} set={set} />}
        {step === 1 && <Step2 data={data} set={set} />}
        {step === 2 && <Step3 data={data} toggle={(v) => toggleArr("toneTags", v)} />}
          {step === 3 && <Step4 data={data} set={set} toggle={(v) => toggleArr("channels", v)} />}
      </div>

      {/* Error */}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
        <button
          type="button"
          onClick={() => { setError(""); setStep((s) => s - 1); }}
          disabled={step === 0}
          className="text-sm text-zinc-500 hover:text-zinc-300 disabled:invisible transition-colors"
        >
          ← ย้อนกลับ
        </button>

        {step < total - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl bg-violet-600 px-7 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            ถัดไป →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-xl bg-violet-600 px-7 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {saving ? "กำลังบันทึก..." : "เริ่มใช้งาน Full Agency 🚀"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Step 1: Brand name & tagline ─── */
function Step1({ data, set }: { data: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-200">
          ชื่อแบรนด์ <span className="text-violet-400">*</span>
        </label>
        <input
          autoFocus
          value={data.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="เช่น Trusme Cosmetics"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-200">Tagline / สโลแกน</label>
        <input
          value={data.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          placeholder="เช่น ผิวดีมีได้ทุกวัน"
          className={inputCls}
        />
        <p className="text-xs text-zinc-600">ไม่บังคับ — ใส่ถ้ามี slogan ประจำแบรนด์</p>
      </div>
    </>
  );
}

/* ─── Step 2: About & audience ─── */
function Step2({ data, set }: { data: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-200">
          เกี่ยวกับแบรนด์ <span className="text-violet-400">*</span>
        </label>
        <textarea
          autoFocus
          rows={4}
          value={data.about}
          onChange={(e) => set("about", e.target.value)}
          placeholder="เช่น แบรนด์ Skincare สำหรับคนไทย เน้นส่วนผสมธรรมชาติ ราคาเข้าถึงได้ ใช้ได้ทุกสภาพผิว..."
          className={inputCls}
        />
        <p className="text-xs text-zinc-600">ยิ่งละเอียด AI ยิ่งสร้าง Content ได้ตรงแบรนด์</p>
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-200">กลุ่มเป้าหมาย</label>
        <input
          value={data.audience}
          onChange={(e) => set("audience", e.target.value)}
          placeholder="เช่น ผู้หญิงอายุ 20–35 ชอบดูแลตัวเอง มีกำลังซื้อปานกลาง"
          className={inputCls}
        />
      </div>
    </>
  );
}

/* ─── Step 3: Tone ─── */
function Step3({ data, toggle }: { data: FormData; toggle: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">เลือกโทนเสียงที่ตรงกับแบรนด์ (เลือกได้หลายอัน)</p>
      <div className="flex flex-wrap gap-2.5">
        {TONE_OPTIONS.map((t) => {
          const active = data.toneTags.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={`rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                active
                  ? "bg-violet-600 border-violet-600 text-white scale-105"
                  : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-violet-500 hover:text-white"
              }`}
            >
              {active && <span className="mr-1.5">✓</span>}
              {t}
            </button>
          );
        })}
      </div>
      {data.toneTags.length === 0 && (
        <p className="text-xs text-zinc-600">ข้ามได้ — แก้ไขทีหลังได้ใน Brand DNA</p>
      )}
      {data.toneTags.length > 0 && (
        <p className="text-xs text-violet-400">เลือกแล้ว {data.toneTags.length} โทน</p>
      )}
    </div>
  );
}

/* ─── Step 4: Channels & color ─── */
function Step4({
  data,
  set,
  toggle,
}: {
  data: FormData;
  set: (k: keyof FormData, v: string) => void;
  toggle: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-200">Platform ที่ใช้</label>
        <div className="grid grid-cols-2 gap-2.5">
          {CHANNEL_OPTIONS.map((c) => {
            const active = data.channels.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-sm font-medium transition-all ${
                  active
                    ? "border-violet-500 bg-violet-600/10 text-white"
                    : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${active ? "bg-violet-600 text-white" : "bg-zinc-700 text-zinc-300"}`}>
                  {c.icon}
                </span>
                <span>{c.label}</span>
                {active && <span className="ml-auto text-violet-400">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <label className="block text-sm font-medium text-zinc-200">สีของแบรนด์</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "primaryColor" as const,   label: "Primary",   hint: "สีหลัก" },
            { key: "secondaryColor" as const, label: "Secondary", hint: "สีรอง" },
            { key: "thirdColor" as const,     label: "Accent",    hint: "สีเสริม" },
          ].map(({ key, label, hint }) => (
            <div key={key} className="flex flex-col items-center gap-2">
              <div
                className="h-14 w-full rounded-xl border-2 border-zinc-700 overflow-hidden cursor-pointer relative"
                style={{ backgroundColor: data[key] }}
              >
                <input
                  type="color"
                  value={data[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-zinc-300">{label}</p>
                <p className="text-[10px] text-zinc-600">{hint}</p>
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{data[key].toUpperCase()}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Preview swatch */}
        <div className="flex gap-1.5 mt-1 h-3 rounded-full overflow-hidden">
          <div className="flex-1 rounded-l-full" style={{ backgroundColor: data.primaryColor }} />
          <div className="flex-1" style={{ backgroundColor: data.secondaryColor }} />
          <div className="flex-1 rounded-r-full" style={{ backgroundColor: data.thirdColor }} />
        </div>
        <p className="text-xs text-zinc-600">คลิกที่สีเพื่อเปลี่ยน — AI จะใช้ palette นี้สร้างรูปให้</p>
      </div>
    </>
  );
}

const inputCls =
  "w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors";
