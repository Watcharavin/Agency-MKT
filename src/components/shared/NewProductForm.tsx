"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Skincare", "Makeup", "Haircare", "Supplement", "Food & Drink", "Fashion", "Accessory", "Home", "Other"];

export function NewProductForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<{ url: string; preview: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);

    // Show preview immediately via object URL
    const previews = files.map((file) => ({
      url: "",
      preview: URL.createObjectURL(file),
      name: file.name,
      _file: file,
    }));
    setPhotos((prev) => [...prev, ...previews.map(({ _file: _, ...p }) => p)]);

    const MAX_MB = 4;
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif"];

    const tooLarge = files.filter((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooLarge.length > 0) {
      setUploadError(`ไฟล์ใหญ่เกินไป: ${tooLarge.map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`).join(", ")} — สูงสุด ${MAX_MB} MB`);
      setPhotos((prev) => prev.filter((p) => p.url !== ""));
      setUploading(false);
      return;
    }

    const blocked = files.filter((f) => !ALLOWED.includes(f.type));
    if (blocked.length > 0) {
      setUploadError(`ไฟล์ไม่รองรับ: ${blocked.map((f) => f.name).join(", ")} — ใช้ได้เฉพาะ JPG, PNG, WEBP, HEIC`);
      setPhotos((prev) => prev.filter((p) => p.url !== ""));
      setUploading(false);
      return;
    }

    try {
      const results = await Promise.allSettled(
        files.map(async (file, i) => {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/products/upload-file", { method: "POST", body: fd });
          if (!res.ok) throw new Error(await res.text());
          const { url } = await res.json();
          return { blobUrl: url as string, preview: previews[i].preview };
        })
      );
      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<{ blobUrl: string; preview: string }> => r.status === "fulfilled")
        .map((r) => r.value);
      const failed = results
        .map((r, i) => (r.status === "rejected" ? { preview: previews[i].preview, name: files[i].name, reason: (r as PromiseRejectedResult).reason } : null))
        .filter((x): x is { preview: string; name: string; reason: unknown } => x !== null);

      setPhotos((prev) =>
        prev
          .filter((p) => !failed.map((f) => f.preview).includes(p.preview))
          .map((p) => {
            const match = succeeded.find((u) => u.preview === p.preview);
            return match ? { ...p, url: match.blobUrl } : p;
          })
      );
      if (failed.length > 0) {
        setUploadError(`อัปโหลดไม่สำเร็จ: ${failed.map((f) => f.name).join(", ")}`);
      }
    } catch (err) {
      setUploadError(String(err));
      setPhotos((prev) => prev.filter((p) => p.url !== ""));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removePhoto(preview: string) {
    setPhotos((prev) => prev.filter((p) => p.preview !== preview));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,$/, "");
      if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
      setTagInput("");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const priceRaw = fd.get("price") as string;
    const body = {
      name:        fd.get("name"),
      sku:         fd.get("sku"),
      price:       priceRaw ? parseFloat(priceRaw) : null,
      description: fd.get("description"),
      category:    fd.get("category"),
      tags,
      photoUrls:   photos.filter((p) => p.url).map((p) => p.url),
    };
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.push("/products");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 items-start">

      {/* ── Left column ── */}
      <div className="space-y-4">

        {/* Basic info */}
        <Card title="ข้อมูลสินค้า" desc="ชื่อ รหัส ราคา และหมวดหมู่">
          <Field label="ชื่อสินค้า" required>
            <input name="name" required placeholder="เช่น Trusme Vitamin C Serum 30ml" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU / รหัสสินค้า">
              <input name="sku" placeholder="TC-SER-001" className={cn(inputCls, "font-mono")} />
            </Field>
            <Field label="ราคา (บาท)">
              <input name="price" type="number" min="0" step="0.01" placeholder="890" className={inputCls} />
            </Field>
          </div>
          <Field label="หมวดหมู่">
            <select name="category" className={inputCls}>
              <option value="">— เลือกหมวดหมู่ —</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="คำอธิบายสินค้า" hint="AI จะใช้ข้อมูลนี้ในการสร้าง Content">
            <textarea name="description" rows={4} placeholder="จุดเด่น ส่วนผสม วิธีใช้ ฯลฯ" className={inputCls} />
          </Field>
        </Card>

        {/* Tags */}
        <Card title="Tags" desc="กด Enter หรือ , เพื่อเพิ่ม tag">
          <div className="flex flex-wrap gap-1.5 min-h-8">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground">
                {t}
                <button type="button" onClick={() => setTags((p) => p.filter((x) => x !== t))}
                  className="text-muted-foreground hover:text-foreground leading-none">×</button>
              </span>
            ))}
          </div>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="พิมพ์ tag แล้วกด Enter..."
            className={inputCls}
          />
        </Card>
      </div>

      {/* ── Right column ── */}
      <div className="space-y-4">

        {/* Photos */}
        <Card title="รูปสินค้า" desc="อัปโหลดได้หลายรูป — AI ใช้รูปในการสร้าง Content">
          {/* Upload zone */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "w-full rounded-md border-2 border-dashed border-border bg-background py-8 text-center transition-colors",
              uploading ? "opacity-50 cursor-wait" : "hover:bg-secondary cursor-pointer"
            )}
          >
            {uploading ? (
              <p className="text-sm text-muted-foreground">กำลังอัปโหลด...</p>
            ) : (
              <>
                <p className="text-2xl mb-2">◧</p>
                <p className="text-sm text-foreground font-medium">คลิกเพื่ออัปโหลดรูป</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP · หลายรูปได้</p>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoChange}
          />

          {/* Photo grid */}
          {uploadError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-md px-3 py-2">{uploadError}</p>
          )}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {photos.map((p) => (
                <div key={p.preview} className="relative group rounded-md overflow-hidden border border-border aspect-square bg-secondary">
                  {p.url === "" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                      <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt={p.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.preview)}
                    className="absolute top-1 right-1 rounded-full bg-foreground/80 text-card w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground/70 hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกสินค้า"}
          </button>
        </div>
      </div>

    </form>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
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

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/50 focus:border-foreground/40 focus:outline-none focus:ring-1 " +
  "focus:ring-foreground/10 transition-colors resize-none";
