import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { eq } from "drizzle-orm";
import { BrandDNAForm } from "@/components/shared/BrandDNAForm";

export default async function BrandPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const rows = await db
    .select()
    .from(brands)
    .where(eq(brands.userId, userId))
    .limit(1);

  return <BrandDNAForm initialData={rows[0] ?? null} />;
}
