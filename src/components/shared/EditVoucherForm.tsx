"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { VoucherCollection, Coupon, Product } from "@/db/schema";

type CouponDraft = {
  id: string;
  isNew: boolean;
  name: string;
  productId: string;
  discount: string;
  code: string;
};

export function EditVoucherForm({
  voucher,
  coupons,
  products,
}: {
  voucher: VoucherCollection;
  coupons: Coupon[];
  products: Product[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(voucher.name);
  const [validFrom, setValidFrom] = useState(voucher.validFrom ? new Date(voucher.validFrom).toISOString().split("T")[0] : "");
  const [validUntil, setValidUntil] = useState(voucher.validUntil ? new Date(voucher.validUntil).toISOString().split("T")[0] : "");
  const [valueCap, setValueCap] = useState(voucher.valueCap ?? "");
  const [status, setStatus] = useState<"draft" | "active">((voucher.status as "draft" | "active") ?? "draft");
  const [caption, setCaption] = useState(voucher.caption ?? "");
  const [mergeMode, setMergeMode] = useState<"auto" | "product_photos">((voucher.mergeMode as "auto" | "product_photos") ?? "auto");

  const [couponList, setCouponList] = useState<CouponDraft[]>(
    coupons.length > 0
      ? coupons.map((c) => ({
          id: c.id,
          isNew: false,
          name: c.name,
          productId: c.productId ?? "",
          discount: c.discount ?? "",
          code: c.code ?? "",
        }))
      : [{ id: crypto.randomUUID(), isNew: true, name: "", productId: "", discount: "", code: "" }]
  );

  function addCoupon() {
    setCouponList((prev) => [...prev, { id: crypto.randomUUID(), isNew: true, name: "", productId: "", discount: "", code: "" }]);
  }

  function removeCoupon(id: string) {
    setCouponList((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCoupon(id: string, field: keyof CouponDraft, value: string) {
    setCouponList((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/vouchers/${voucher.id}`, {
        method: "PATCH",
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
              id: c.isNew ? null : c.id,
              name: c.name.trim(),
              productId: c.productId || null,
              discount: c.discount.trim() || null,
              code: c.code.trim() || null,
            })),
        }),
      });
      router.push("/super-aff");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-0 -mt-1">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
        <Link href="/super-aff" className="hover:text-foreground transition-colors">Super AFF</Link>
        <span>/</span>
        <span className="text-foreground">Edit Voucher</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Edit Voucher</h1>
        <p className="text-sm text-muted-foreground mt-1">{voucher.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 items-start">

        {/* Left */}
        <div className="space-y-4">
          <Card title="ข้อมูล Voucher" desc="ชื่อ ช่วงเวลา และ setting หลัก">
            <Field label="ชื่อ Voucher" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="เริ่มใช้ได้">
                <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
              </Field>
              <Field label="หมดอายุ">
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Value Cap">
              <input value={valueCap} onChange={(e) => setValueCap(e.target.value)} placeholder="เช่น ฿500" className={inputCls} />
            </Field>
            <Field label="สถานะ">
              <div className="flex gap-2">
                {(["draft", "active"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "flex-1 rounded-md border py-2 text-xs font-medium transition-colors",
                      status === s ? "border-foreground bg-foreground text-card" : "border-border bg-background text-foreground hover:bg-secondary"
                    )}
                  >
                    {s === "draft" ? "Draft" : "Active"}
                  </button>
                ))}
              </div>
            </Field>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <Card title="Collection" desc="รายละเอียดของ collection">
            <Field label="Caption">
              <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="คำอธิบายสั้นๆ" className={inputCls} />
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
                      mergeMode === mode ? "border-foreground bg-foreground text-card" : "border-border bg-background text-foreground hover:bg-secondary"
                    )}
                  >
                    {mode === "product_photos" ? "Use product photos" : "Merge automatically"}
                  </button>
                ))}
              </div>
            </Field>
          </Card>

          <Card title="Coupons" desc={`${couponList.length} coupon`}>
            <div className="space-y-3">
              {couponList.map((coupon, idx) => (
                <div key={coupon.id} className="rounded-md border border-border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Coupon {idx + 1}</span>
                    {couponList.length > 1 && (
                      <button type="button" onClick={() => removeCoupon(coupon.id)} className="text-muted-foreground hover:text-foreground text-xs">×</button>
                    )}
                  </div>
                  <input value={coupon.name} onChange={(e) => updateCoupon(coupon.id, "name", e.target.value)} placeholder="ชื่อ coupon" className={inputCls} />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={coupon.productId} onChange={(e) => updateCoupon(coupon.id, "productId", e.target.value)} className={inputCls}>
                      <option value="">— เลือกสินค้า —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input value={coupon.discount} onChange={(e) => updateCoupon(coupon.id, "discount", e.target.value)} placeholder="เช่น 10% OFF" className={inputCls} />
                  </div>
                  <input value={coupon.code} onChange={(e) => updateCoupon(coupon.id, "code", e.target.value)} placeholder="รหัสส่วนลด (optional)" className={cn(inputCls, "font-mono text-xs")} />
                </div>
              ))}
            </div>
            <button type="button" onClick={addCoupon} className="w-full rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors">
              + Add coupon
            </button>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
        <Link href="/super-aff" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← ยกเลิก</Link>
        <button
          type="button"
          disabled={!name.trim() || saving}
          onClick={handleSave}
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-card hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </div>
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-foreground">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/50 focus:border-foreground/40 focus:outline-none focus:ring-1 " +
  "focus:ring-foreground/10 transition-colors resize-none";
