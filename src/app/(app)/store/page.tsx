export default function StorePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Catalog</p>
        <h1 className="text-xl font-semibold text-foreground mt-0.5">Store</h1>
        <p className="text-sm text-muted-foreground mt-0.5">ตั้งค่าร้านค้าและช่องทางขาย</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-2xl mb-3">□</p>
        <p className="text-sm text-foreground font-medium">Coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">
          เชื่อมต่อร้านค้ากับ LINE Shopping, Shopee, Lazada และอื่น ๆ
        </p>
      </div>
    </div>
  );
}
