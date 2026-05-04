import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { brands, voucherCollections, coupons, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { EditVoucherForm } from "@/components/shared/EditVoucherForm";

export default async function EditVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  const brand = brandRows[0] ?? null;
  if (!brand) redirect("/onboarding");

  const voucherRows = await db
    .select()
    .from(voucherCollections)
    .where(and(eq(voucherCollections.id, id), eq(voucherCollections.brandId, brand.id)))
    .limit(1);

  if (voucherRows.length === 0) notFound();

  const voucher = voucherRows[0];
  const couponList = await db.select().from(coupons).where(eq(coupons.collectionId, id));
  const productList = await db.select().from(products).where(eq(products.brandId, brand.id));

  return <EditVoucherForm voucher={voucher} coupons={couponList} products={productList} />;
}
