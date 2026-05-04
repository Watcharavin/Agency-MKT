"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Brand, Product } from "@/db/schema";

type CouponDraft = {
  id: string;
  name: string;
  productId: string;
  discount: string;
  code: string;
};

export function CreateVoucherForm({
  brand,
  products,
}: {
  brand: Brand | null;
  products: Product[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [navigateTo, setNavigateTo] = useState<"draft" | "campaign" | null>(null);

  // Voucher metadata
  const [name, setName] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [valueCap, setValueCap] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");

  // Collection settings
  const [caption, setCaption] = useState("");
  const [mergeMode, setMergeMode] = useState<"auto" | "product_photos">("auto");

  // Coupons
  const [couponList, setCouponList] = useState<CouponDraft[]>([
    { id: crypto.randomUUID(), name: "", productId: "", discount: "", code: "" },
  ]);

  function addCoupon() {
    setCouponList((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", productId: "", discount: "", code: "" },
    ]);
  }

  function removeCoupon(id: string) {
    setCouponList((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCoupon(id: string, field: keyof CouponDraft, value: string) {
    setCouponList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  async function handleSave(destination: "draft" | "campaign") {
    if (!name.trim()) return;
    setSaving(true);
    setNavigateTo(destination);
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          caption: caption.trim() || null,
          mergeMode,
          valueCap: valueCap.trim() || null,
          status,
          validFrom: validFrom || null,
          validUntil: validUntil || null,
          coupons: couponList
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name.trim(),
              productId: c.productId || null,
              discount: c.discount.trim() || null,
              code: c.code.trim() || null,
            })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (destination === "campaign") {
          router.push(`/campaigns/new?type=superaff&voucherId=${data.id}`);
        } else {
          router.push("/super-aff");
        }
      }
    } finally {
      setSaving(false);
      setNavigateTo(null);
    }
  }

  return (
    <div className="flex flex-col gap-0 -mt-1">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
        <Link href="/super-aff" className="hover:text-foreground transition-colors">
          Super AFF
        </Link>
        <span>/</span>
        <span className="text-foreground">New Voucher</span>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">New Voucher</h1>
        <p className="text-sm text-muted-foreground mt-1">
          สร้าง voucher พร้อม collection และ coupon แต่ละใบ ก่อนส่งให้ AI สร้างรูป
        </p>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-2 gap-4 items-start">

        {/* ── Left: Voucher metadata ── */}
        <div className="space-y-4">
          <Card title="ข้อมูล Voucher" desc="ชื่อ ช่วงเวลา และ setting หลัก">
            {/* ชื่อ */}
            <Field label="ชื่อ Voucher" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น Summer Bundle 2025"
                className={inputCls}
              />
            </Field>

            {/* Active period */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="เริ่มใช้ได้">
                <input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="หมดอายุ">
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Value cap */}
            <Field label="Value Cap" hint="มูลค่าสูงสุดที่ให้ส่วนลด เช่น ฿500">
              <input
                value={valueCap}
                onChange={(e) => setValueCap(e.target.value)}
                placeholder="เช่น ฿500"
                className={inputCls}
              />
            </Field>

            {/* Status */}
            <Field label="สถานะ">
              <div className="flex gap-2">
                {(["draft", "active"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "flex-1 rounded-md border py-2 text-xs font-medium transition-colors",
                      status === s
                        ? "border-foreground bg-foreground text-card"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    )}
                  >
                    {s === "draft" ? "Draft" : "Active"}
                  </button>
                ))}
              </div>
            </Field>
          </Card>
        </div>

        {/* ── Right: Collection + Coupons ── */}
        <div className="space-y-4">

          {/* Collection card */}
          <Card title="Collection" desc="รายละเอียดของ collection ที่จะส่งให้ Affiliate">
            <Field label="Caption" hint="คำอธิบายสั้นๆ บน collection">
              <textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="เช่น 3 ขวดสุดคุ้ม ส่งตรงจากแบรนด์"
                className={inputCls}
              />
            </Field>

            <Field label="รูปที่ใช้สร้าง Collection">
              <div className="grid grid-cols-2 gap-2">
                {(["product_photos", "auto"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setMergeMode(mode)}
                    className={cn(
                      "rounded-md border py-2.5 text-xs font-medium transition-colors text-center",
                      mergeMode === mode
                        ? "border-foreground bg-foreground text-card"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    )}
                  >
                    {mode === "product_photos" ? "Use product photos" : "Merge automatically"}
                  </button>
                ))}
              </div>
            </Field>
          </Card>

          {/* Coupons card */}
          <Card title="Coupons" desc={`${couponList.length} coupon · 1 รูปต่อ 1 coupon`}>
            <div className="space-y-3">
              {couponList.map((coupon, idx) => (
                <div
                  key={coupon.id}
                  className="rounded-md border border-border bg-background p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                      Coupon {idx + 1}
                    </span>
                    {couponList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCoupon(coupon.id)}
                        className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* ชื่อ coupon */}
                  <input
                    value={coupon.name}
                    onChange={(e) => updateCoupon(coupon.id, "name", e.target.value)}
                    placeholder="ชื่อ coupon เช่น Vitamin C Bundle"
                    className={inputCls}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    {/* Linked product */}
                    <select
                      value={coupon.productId}
                      onChange={(e) => updateCoupon(coupon.id, "productId", e.target.value)}
                      className={inputCls}
                    >
                      <option value="">— เลือกสินค้า —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    {/* Discount */}
                    <input
                      value={coupon.discount}
                      onChange={(e) => updateCoupon(coupon.id, "discount", e.target.value)}
                      placeholder="เช่น 10% OFF"
                      className={inputCls}
                    />
                  </div>

                  {/* Code (optional) */}
                  <input
                    value={coupon.code}
                    onChange={(e) => updateCoupon(coupon.id, "code", e.target.value)}
                    placeholder="รหัสส่วนลด (optional) เช่น SUMMER10"
                    className={cn(inputCls, "font-mono text-xs")}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addCoupon}
              className="w-full rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
            >
              + Add coupon
            </button>
          </Card>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
        <Link
          href="/super-aff"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← ยกเลิก
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!name.trim() || saving}
            onClick={() => handleSave("draft")}
            className="rounded-md border border-border bg-card px-5 py-2 text-sm text-foreground/80 hover:bg-secondary disabled:opacity-40 transition-colors"
          >
            {saving && navigateTo === "draft" ? "กำลังบันทึก…" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={!name.trim() || saving}
            onClick={() => handleSave("campaign")}
            className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-card hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {saving && navigateTo === "campaign" ? "กำลังบันทึก…" : "Use in campaign →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
  "placeholder:text-muted-foreground/50 focus:border-foreground/40 focus:outline-none focus:ring-1 " +
  "focus:ring-foreground/10 transition-colors resize-none";
