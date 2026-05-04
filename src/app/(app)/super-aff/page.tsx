import Link from "next/link";

export default function SuperAffPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Distribution</p>
          <h1 className="text-xl font-semibold text-foreground mt-0.5">Super Affiliate</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Voucher Collections ที่ส่งให้ Affiliate แชร์ต่อ</p>
        </div>
        <Link
          href="/vouchers/new"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity"
        >
          📦 New Voucher
        </Link>
      </div>

      {/* ข้อมูลการทำงาน */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-medium text-foreground mb-2">วิธีทำงาน</p>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-mono text-foreground">1.</span>
            <span>สร้าง <strong className="text-foreground">Collection</strong> — ตั้งชื่อกลุ่ม voucher</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-mono text-foreground">2.</span>
            <span>เพิ่ม <strong className="text-foreground">Coupon</strong> ได้หลายใบใน Collection เดียว</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-mono text-foreground">3.</span>
            <span>ระบบรวมรูป coupon ทั้งหมดเป็น <strong className="text-foreground">merged image</strong> อัตโนมัติ</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-mono text-foreground">4.</span>
            <span>ส่งให้ Affiliate แชร์ผ่าน LINE · Facebook · Instagram · TikTok</span>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-2xl mb-3">📦</p>
        <p className="text-sm text-foreground font-medium">ยังไม่มี Voucher Collection</p>
        <p className="text-xs text-muted-foreground mt-1">
          สร้าง Collection แรก — ใส่ Coupon ได้หลายใบ แล้วส่งให้ Affiliate แชร์ต่อ
        </p>
        <Link
          href="/vouchers/new"
          className="mt-5 inline-block rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
        >
          สร้าง Collection แรก
        </Link>
      </div>
    </div>
  );
}
