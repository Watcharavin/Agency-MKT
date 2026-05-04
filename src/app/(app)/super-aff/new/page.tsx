import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CreateVoucherForm } from "@/components/shared/NewVoucherCampaign";

export default async function NewVoucherDataPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  const brand = brandRows[0] ?? null;

  const productList = brand
    ? await db.select().from(products).where(eq(products.brandId, brand.id))
    : [];

  return <CreateVoucherForm brand={brand} products={productList} />;
}
