import { cache } from "react";
import { db } from "@/db";
import { brands, products, voucherCollections, campaigns } from "@/db/schema";
import { eq } from "drizzle-orm";

// React cache() deduplicates identical calls within the same request —
// so pages that fetch brand + products won't hit the DB twice.
export const getCachedBrand = cache((userId: string) =>
  db.select().from(brands).where(eq(brands.userId, userId)).limit(1)
);

export const getCachedProducts = cache((brandId: string) =>
  db.select().from(products).where(eq(products.brandId, brandId))
);

export const getCachedVouchers = cache((brandId: string) =>
  db.select().from(voucherCollections).where(eq(voucherCollections.brandId, brandId))
);

export const getCachedCampaigns = cache((brandId: string) =>
  db.select().from(campaigns).where(eq(campaigns.brandId, brandId))
);
