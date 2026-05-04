import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, campaigns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CampaignList } from "@/components/shared/CampaignList";

export default async function CampaignsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const brandRows = await db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId)).limit(1);
  const brand = brandRows[0] ?? null;

  const list = brand
    ? await db.select().from(campaigns).where(eq(campaigns.brandId, brand.id))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Distribution</p>
          <h1 className="text-xl font-semibold text-foreground mt-0.5">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{list.length} campaign</p>
        </div>
        <Link
          href="/campaigns/new?type=platform"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-card hover:opacity-80 transition-opacity"
        >
          ↗ To Platform
        </Link>
      </div>
      <CampaignList campaigns={list} />
    </div>
  );
}
