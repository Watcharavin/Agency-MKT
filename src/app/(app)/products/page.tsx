import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function ProductsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const brand = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  const items = brand.length
    ? await db.select().from(products).where(eq(products.brandId, brand[0].id))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Catalog</p>
          <h1 className="text-xl font-semibold text-foreground mt-0.5">สินค้า</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.length} รายการ</p>
        </div>
        <Link
          href="/products/new"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity"
        >
          + เพิ่มสินค้า
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-2xl mb-3">◧</p>
          <p className="text-sm text-foreground font-medium">ยังไม่มีสินค้า</p>
          <p className="text-xs text-muted-foreground mt-1">เพิ่มสินค้าพร้อมรูปเพื่อให้ AI ใช้สร้าง Content</p>
          <Link
            href="/products/new"
            className="mt-5 inline-block rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            เพิ่มสินค้าแรก
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="rounded-lg border border-border bg-card overflow-hidden hover:border-foreground/30 transition-colors group"
            >
              {/* รูปสินค้า */}
              <div className="aspect-square bg-secondary flex items-center justify-center overflow-hidden">
                {p.photoUrls && p.photoUrls.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photoUrls[0]}
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <span className="text-3xl text-muted-foreground/30">◧</span>
                )}
              </div>
              {/* ข้อมูล */}
              <div className="p-3">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">{p.category ?? "—"}</p>
                  <p className="text-xs font-mono text-foreground">
                    {p.price != null ? `฿${(p.price / 100).toLocaleString()}` : "—"}
                  </p>
                </div>
                {p.sku && (
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">{p.sku}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
