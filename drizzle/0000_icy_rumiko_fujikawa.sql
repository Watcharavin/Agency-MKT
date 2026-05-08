CREATE TYPE "public"."asset_type" AS ENUM('slide', 'caption', 'hashtags');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'generating', 'generated', 'scheduled', 'published');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('Facebook', 'Instagram', 'LINE', 'TikTok');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('line', 'facebook', 'instagram', 'x', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"about" text,
	"tone_tags" jsonb DEFAULT '[]'::jsonb,
	"primary_color" text DEFAULT '#7c3aed',
	"secondary_color" text DEFAULT '#a78bfa',
	"third_color" text DEFAULT '#1e1b4b',
	"logo_url" text,
	"audience" text,
	"channels" jsonb DEFAULT '[]'::jsonb,
	"languages" jsonb DEFAULT '[]'::jsonb,
	"do_say" text,
	"dont_say" text,
	"display_font" text DEFAULT 'Inter',
	"body_font" text DEFAULT 'Inter',
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"product_id" text,
	"channel" "channel" NOT NULL,
	"topic" text NOT NULL,
	"brief" text,
	"audience" text,
	"tone" text DEFAULT 'Educational',
	"language" text DEFAULT 'TH',
	"slide_count" integer DEFAULT 3,
	"image_ratio" text DEFAULT '1:1',
	"pillar" text,
	"goal" text,
	"cta" text,
	"caption_length" text DEFAULT 'Medium',
	"footer_style" text DEFAULT 'Full',
	"status" "campaign_status" DEFAULT 'draft',
	"scheduled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"product_id" text,
	"name" text NOT NULL,
	"code" text,
	"discount" text,
	"image_url" text,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generated_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"slide_index" integer,
	"image_url" text,
	"text_content" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"social_account_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"post_status" "post_status" DEFAULT 'pending',
	"platform_post_id" text,
	"platform_post_url" text,
	"error_message" text,
	"posted_at" timestamp,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"price" integer,
	"description" text,
	"photo_urls" jsonb DEFAULT '[]'::jsonb,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"platform_account_id" text,
	"platform_account_name" text,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voucher_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"caption" text,
	"merge_mode" text DEFAULT 'auto',
	"value_cap" text,
	"status" text DEFAULT 'draft',
	"valid_from" timestamp,
	"valid_until" timestamp,
	"cover_image_url" text,
	"merged_image_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_collection_id_voucher_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."voucher_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_assets" ADD CONSTRAINT "generated_assets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_logs" ADD CONSTRAINT "post_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_logs" ADD CONSTRAINT "post_logs_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_collections" ADD CONSTRAINT "voucher_collections_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;