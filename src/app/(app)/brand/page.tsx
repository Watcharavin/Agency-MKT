import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCachedBrand } from "@/lib/data";
import { BrandDNAForm } from "@/components/shared/BrandDNAForm";

export default async function BrandPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const rows = await getCachedBrand(userId);
  return <BrandDNAForm initialData={rows[0] ?? null} />;
}
