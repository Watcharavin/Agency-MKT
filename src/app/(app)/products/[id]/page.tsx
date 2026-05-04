import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { EditProductForm } from "@/components/shared/EditProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  if (brandRows.length === 0) redirect("/onboarding");

  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.brandId, brandRows[0].id)))
    .limit(1);

  if (productRows.length === 0) notFound();
  const product = productRows[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/products" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← กลับ สินค้า
        </Link>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-3">Catalog</p>
        <h1 className="text-xl font-semibold text-foreground mt-0.5">แก้ไขสินค้า</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{product.name}</p>
      </div>
      <EditProductForm product={product} />
    </div>
  );
}
