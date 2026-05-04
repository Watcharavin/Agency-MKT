import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NewPlatformCampaignForm } from "@/components/shared/NewPlatformCampaignForm";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { type } = await searchParams;
  if (type !== "platform") redirect("/campaigns/new?type=platform");

  const brandRows = await db.select().from(brands).where(eq(brands.userId, userId)).limit(1);
  const brand = brandRows[0] ?? null;

  const productList = brand
    ? await db.select().from(products).where(eq(products.brandId, brand.id))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← กลับ Campaigns
        </Link>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-3">Create</p>
        <h1 className="text-xl font-semibold text-foreground mt-0.5">New Campaign — Platform</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          AI สร้างรูป carousel + caption + hashtags สำหรับ Social Media
        </p>
      </div>
      <NewPlatformCampaignForm brand={brand} products={productList} />
    </div>
  );
}
