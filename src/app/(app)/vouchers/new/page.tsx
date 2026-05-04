import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, voucherCollections, coupons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GenerateVoucherForm } from "@/components/shared/GenerateVoucherForm";

export default async function GenerateVoucherPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  const brand = brandRows[0] ?? null;

  const vouchers = brand
    ? await db.select().from(voucherCollections).where(eq(voucherCollections.brandId, brand.id))
    : [];

  const couponCountMap: Record<string, number> = {};
  for (const v of vouchers) {
    const rows = await db.select().from(coupons).where(eq(coupons.collectionId, v.id));
    couponCountMap[v.id] = rows.length;
  }

  return (
    <GenerateVoucherForm
      brand={brand}
      vouchers={vouchers.map((v) => ({ ...v, couponCount: couponCountMap[v.id] ?? 0 }))}
    />
  );
}
