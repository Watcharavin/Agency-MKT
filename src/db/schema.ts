import { pgTable, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────
export const channelEnum = pgEnum("channel", ["Facebook", "Instagram", "LINE", "TikTok"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "generating", "generated", "scheduled", "published"]);
export const assetTypeEnum = pgEnum("asset_type", ["slide", "caption", "hashtags"]);

// ─── Brands (Brand DNA) ───────────────────────────────────────────────────
export const brands = pgTable("brands", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:        text("user_id").notNull(),           // from Clerk
  name:          text("name").notNull(),
  tagline:       text("tagline"),
  about:         text("about"),
  toneTags:      jsonb("tone_tags").$type<string[]>().default([]),
  primaryColor:   text("primary_color").default("#7c3aed"),
  secondaryColor: text("secondary_color").default("#a78bfa"),
  thirdColor:     text("third_color").default("#1e1b4b"),
  logoUrl:        text("logo_url"),                  // Vercel Blob URL
  audience:      text("audience"),
  channels:      jsonb("channels").$type<string[]>().default([]),
  languages:     jsonb("languages").$type<string[]>().default([]),
  doSay:         text("do_say"),
  dontSay:       text("dont_say"),
  displayFont:   text("display_font").default("Inter"),
  bodyFont:      text("body_font").default("Inter"),
  socialLinks:   jsonb("social_links").$type<{
    facebook?:   string;
    instagram?:  string;
    tiktok?:     string;
    tiktokShop?: string;
    line?:       string;
    lineUrl?:    string;
    shopee?:     string;
    phone?:      string;
  }>().default({}),
  createdAt:     timestamp("created_at").defaultNow(),
  updatedAt:     timestamp("updated_at").defaultNow(),
});

// ─── Products ─────────────────────────────────────────────────────────────
export const products = pgTable("products", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  brandId:       text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  name:          text("name").notNull(),
  sku:           text("sku"),
  price:         integer("price"),                   // สตางค์ (e.g. 89000 = ฿890)
  description:   text("description"),
  photoUrls:     jsonb("photo_urls").$type<string[]>().default([]),  // Vercel Blob URLs
  category:      text("category"),
  tags:          jsonb("tags").$type<string[]>().default([]),
  createdAt:     timestamp("created_at").defaultNow(),
});

// ─── Campaigns ────────────────────────────────────────────────────────────
export const campaigns = pgTable("campaigns", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  brandId:       text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  productId:     text("product_id").references(() => products.id),   // optional
  channel:       channelEnum("channel").notNull(),
  topic:         text("topic").notNull(),
  brief:         text("brief"),
  audience:      text("audience"),
  tone:          text("tone").default("Educational"),
  language:      text("language").default("TH"),
  slideCount:    integer("slide_count").default(3),
  imageRatio:    text("image_ratio").default("1:1"),
  pillar:        text("pillar"),
  goal:          text("goal"),
  cta:           text("cta"),
  captionLength: text("caption_length").default("Medium"),
  footerStyle:   text("footer_style").default("Full"),
  status:        campaignStatusEnum("status").default("draft"),
  scheduledAt:   timestamp("scheduled_at"),          // for Content Calendar
  createdAt:     timestamp("created_at").defaultNow(),
  updatedAt:     timestamp("updated_at").defaultNow(),
});

// ─── Generated Assets ─────────────────────────────────────────────────────
export const generatedAssets = pgTable("generated_assets", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId:    text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  type:          assetTypeEnum("type").notNull(),
  slideIndex:    integer("slide_index"),              // 0,1,2,3 สำหรับรูป
  imageUrl:      text("image_url"),                  // Vercel Blob URL
  textContent:   text("text_content"),               // caption / hashtags
  createdAt:     timestamp("created_at").defaultNow(),
});

// ─── Voucher Collections (Super AFF) ──────────────────────────────────────
// 1 Collection = กลุ่ม coupon ที่ส่งให้ Affiliate แชร์
export const voucherCollections = pgTable("voucher_collections", {
  id:             text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  brandId:        text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  name:           text("name").notNull(),               // ชื่อ voucher
  description:    text("description"),
  caption:        text("caption"),                      // caption บน collection card
  mergeMode:      text("merge_mode").default("auto"),   // "auto" | "product_photos"
  valueCap:       text("value_cap"),                    // เช่น "฿500" หรือ "10%"
  status:         text("status").default("draft"),      // "draft" | "active"
  validFrom:      timestamp("valid_from"),              // ช่วงเวลา active
  validUntil:     timestamp("valid_until"),
  coverImageUrl:  text("cover_image_url"),              // รูป voucher cover (AI generated)
  mergedImageUrl: text("merged_image_url"),             // รูปรวมของ coupon ทั้งหมด (AI generated)
  createdAt:      timestamp("created_at").defaultNow(),
  updatedAt:      timestamp("updated_at").defaultNow(),
});

// ─── Coupons ───────────────────────────────────────────────────────────────
// coupon แต่ละใบใน collection
export const coupons = pgTable("coupons", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  collectionId:  text("collection_id").notNull().references(() => voucherCollections.id, { onDelete: "cascade" }),
  productId:     text("product_id").references(() => products.id, { onDelete: "set null" }),  // สินค้าที่ผูกกับ coupon
  name:          text("name").notNull(),                // ชื่อ coupon
  code:          text("code"),                          // รหัสส่วนลด
  discount:      text("discount"),                      // เช่น "10%" หรือ "฿200 OFF"
  imageUrl:      text("image_url"),                     // รูป coupon แต่ละใบ (Vercel Blob)
  validFrom:     timestamp("valid_from"),
  validUntil:    timestamp("valid_until"),
  sortOrder:     integer("sort_order").default(0),
  createdAt:     timestamp("created_at").defaultNow(),
});

// ─── Types (inferred) ─────────────────────────────────────────────────────
export type Brand               = typeof brands.$inferSelect;
export type NewBrand            = typeof brands.$inferInsert;
export type Product             = typeof products.$inferSelect;
export type NewProduct          = typeof products.$inferInsert;
export type Campaign            = typeof campaigns.$inferSelect;
export type NewCampaign         = typeof campaigns.$inferInsert;
export type GeneratedAsset      = typeof generatedAssets.$inferSelect;
export type VoucherCollection   = typeof voucherCollections.$inferSelect;
export type NewVoucherCollection = typeof voucherCollections.$inferInsert;
export type Coupon              = typeof coupons.$inferSelect;
export type NewCoupon           = typeof coupons.$inferInsert;
