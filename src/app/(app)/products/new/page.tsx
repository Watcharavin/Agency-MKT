import Link from "next/link";
import { NewProductForm } from "@/components/shared/NewProductForm";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/products" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← กลับ สินค้า
        </Link>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-3">Catalog</p>
        <h1 className="text-xl font-semibold text-foreground mt-0.5">เพิ่มสินค้าใหม่</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          AI จะใช้รูปและข้อมูลสินค้านี้ในการสร้าง Content ให้คุณ
        </p>
      </div>
      <NewProductForm />
    </div>
  );
}
