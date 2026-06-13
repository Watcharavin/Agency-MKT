# Agency-MKT — Project Context

## What this project is

**Agency-MKT** (internal package name `full-agency`) is an AI-powered marketing agency platform built for Thai e-commerce / brand owners. It helps a brand owner:

1. Define their **Brand DNA** (name, tagline, voice, colors, fonts, audience, social links).
2. Manage their **Products** (photos, price, SKU, description, tags).
3. Generate **Social media campaigns** (carousel slides + caption + hashtags) for Facebook / Instagram / LINE / TikTok using AI image generation (KIE) and AI text generation (OpenRouter → Claude Haiku 4.5).
4. Build **Voucher / Coupon collections** (Super-AFF) with AI-generated cover and per-coupon images, intended to be distributed to affiliates.
5. **Auto-post** generated content to connected social accounts on a schedule (LINE / Facebook / Instagram), driven by a daily Vercel Cron job.

The UI is in Thai for end users and is structured as a multi-tenant SaaS where one Clerk user → one brand.

---

## Tech stack

| Layer            | Technology                                                                    |
| ---------------- | ----------------------------------------------------------------------------- |
| Framework        | Next.js **16.2.4** (App Router, React 19.2.4, Turbopack)                      |
| Auth             | Clerk (`@clerk/nextjs` v7) — gates everything except `/`, `/sign-in`, `/sign-up`, `/api/media` |
| Database         | PostgreSQL via Neon serverless driver (`@neondatabase/serverless`)            |
| ORM              | Drizzle ORM (`drizzle-orm` v0.45) + `drizzle-kit` for migrations              |
| File storage     | Vercel Blob (`@vercel/blob`) — mostly **private**, with `/api/media` proxy    |
| AI text          | OpenRouter → `anthropic/claude-haiku-4-5` (caption, hashtags, topic ideas)    |
| AI image         | KIE.ai (`gpt-image-2-image-to-image`) for slides, voucher covers, coupon art  |
| AI SDK deps      | `ai` v6, `@ai-sdk/openai`, `@ai-sdk/gateway`, `@anthropic-ai/sdk`, `@openrouter/ai-sdk-provider` (installed but most flows use raw `fetch` to OpenRouter / KIE) |
| UI               | Tailwind CSS 4, shadcn (`@base-ui/react`), Lucide icons, `class-variance-authority`, `tw-animate-css` |
| Deployment       | Vercel — `vercel.json` registers a daily cron at `09:00` UTC                  |

---

## Repository layout

```
Agency-MKT/
├── vercel.json                 # cron: 0 9 * * * → /api/cron/autopost
├── drizzle.config.ts           # postgres dialect, ./drizzle output dir
├── drizzle/                    # generated SQL migrations (0000_icy_rumiko_fujikawa.sql)
├── next.config.ts              # default config
├── src/
│   ├── proxy.ts                # Clerk middleware (Next 16 names this "proxy", not "middleware")
│   ├── db/
│   │   ├── index.ts            # neon client + drizzle()
│   │   └── schema.ts           # all tables + types
│   ├── lib/
│   │   ├── data.ts             # cached server fetchers (React.cache)
│   │   ├── autopost.ts         # postToLINE / postToFacebook / postToInstagram
│   │   └── utils.ts
│   ├── components/
│   │   ├── ui/button.tsx       # shadcn button
│   │   └── shared/             # all feature forms + lists (BrandDNAForm, NewProductForm,
│   │                           # NewVoucherCampaign, ContentCalendar, CampaignList, etc.)
│   └── app/
│       ├── (auth)/             # /sign-in, /sign-up (Clerk catch-all)
│       ├── (app)/              # authed app shell
│       │   ├── dashboard/
│       │   ├── brand/          # Brand DNA editor
│       │   ├── products/       # list + new + [id] edit
│       │   ├── store/
│       │   ├── campaigns/      # list + new + [id] generate/edit
│       │   ├── content/        # ContentCalendar
│       │   ├── super-aff/      # voucher collection list/new/[id]/[id]/view
│       │   ├── vouchers/       # /vouchers/new, /vouchers/[id]/result
│       │   ├── assets/
│       │   └── settings/       # social account connections
│       ├── onboarding/         # first-time brand setup
│       └── api/                # all Route Handlers (see api-spec.MD)
└── public/                     # placeholder.jpg (KIE fallback input)
```

---

## Data model (Drizzle / Postgres)

Eight tables, all UUID PKs (`crypto.randomUUID()`):

| Table                  | Purpose                                                                                  | Key relations                                          |
| ---------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `brands`               | One per Clerk `userId`. Stores Brand DNA (name, tagline, colors, fonts, voice rules, social links JSON, logo URL). | parent of products, campaigns, voucher_collections, social_accounts |
| `products`             | Brand catalog. Price stored as integer **สตางค์** (e.g. 89000 = ฿890). `photoUrls` is JSON array of Blob URLs. | belongs to brand                                       |
| `campaigns`            | Social post brief. Has `channel` (Facebook / Instagram / LINE / TikTok), `topic`, `pillar`, `goal`, `tone`, `slideCount`, `imageRatio`, `captionLength`, `footerStyle`, `status`, optional `scheduledAt` and `productId`. | belongs to brand, optional product                      |
| `generated_assets`     | The output of campaign generation. `type` ∈ `slide` / `caption` / `hashtags`. Slides have `slideIndex` + `imageUrl`. Captions/hashtags have `textContent`. | belongs to campaign                                    |
| `voucher_collections`  | Super-AFF voucher bundle. `mergeMode` (`auto` / `product_photos`), `valueCap`, `coverImageUrl`, `mergedImageUrl`, validity window. | belongs to brand                                       |
| `coupons`              | Single coupon inside a collection. `code`, `discount`, `imageUrl`, `sortOrder`, optional `productId`. | belongs to voucher_collection, optional product        |
| `social_accounts`      | OAuth-style token for a connected platform (`line` / `facebook` / `instagram` / `x` / `tiktok`). One active per platform per brand. **TODO: tokens are stored unencrypted today.** | belongs to brand                                       |
| `post_logs`            | Result of every autopost attempt — `pending` / `success` / `failed`, plus `platformPostId`, `platformPostUrl`, `errorMessage`, `retryCount`. | belongs to campaign + social_account                    |

Enums: `channel`, `campaign_status` (`draft` → `generating` → `generated` → `scheduled` → `published`), `asset_type`, `platform`, `post_status`.

---

## Auth & routing

- `src/proxy.ts` — Next.js 16 renames `middleware.ts` to `proxy.ts`. Uses Clerk's `clerkMiddleware` and protects every route except `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/media(.*)` (the media proxy must stay public so external services like KIE can fetch product photos).
- The app shell lives under `src/app/(app)/` (route group). Auth pages under `src/app/(auth)/`. First-time onboarding under `src/app/onboarding/`.

---

## AI & generation pipeline

### Image generation (KIE)
1. Client hits `/api/generate/campaign` or `/api/generate/voucher` with a campaign / voucher id.
2. Server fetches Brand DNA + product photos, builds a prompt (Brand DNA + product context + slide / coupon context), wraps private blob URLs through `/api/media` so KIE can reach them.
3. Server calls `POST https://api.kie.ai/api/v1/jobs/createTask` with model `gpt-image-2-image-to-image` and returns one or more `taskId`s.
4. Client polls `/api/generate/status/[taskId]` (which calls KIE `recordInfo`). When the task completes, the route **immediately mirrors** the temp KIE URL into Vercel Blob (KIE URLs expire fast).
5. Client posts the final mirrored URLs to `/api/campaigns/[id]/assets` or `/api/vouchers/[id]/save-images` to persist them on the campaign / voucher.

### Text generation (OpenRouter)
- `/api/campaigns/suggest-topic` — 4 Thai topic ideas tailored to brand + platform + pillar + goal.
- `/api/generate/text` — full caption + hashtags. Heavy prompt: includes Brand DNA, voice rules (`doSay` / `dontSay`), product info, platform-specific style (Instagram / Facebook / TikTok / LINE), pillar-specific structure (Knowledge / Product / Brand / Promotion / Others), then assembles the final caption with brand signature, divider, shop links, and footer based on `footerStyle`.

Both use `anthropic/claude-haiku-4-5` via OpenRouter (raw `fetch`).

---

## Autopost

- `src/lib/autopost.ts` exports `postToLINE`, `postToFacebook`, `postToInstagram`.
- `/api/campaigns/[id]/post` (manual, called from UI) and `/api/cron/autopost` (scheduled, called by Vercel Cron at `0 9 * * *`) both:
  1. Find the campaign's matching active social account.
  2. Stitch caption + hashtags, pick slide 0 as the image.
  3. Call the platform poster, write a row to `post_logs`, and flip `campaigns.status` → `published`.
- Cron is gated by `Authorization: Bearer ${CRON_SECRET}`. `Instagram requires an image`.

---

## Storage strategy

- **Brand logos**, **product photos**, **voucher coupon images** → Vercel Blob with `access: "private"`. The app proxies them to authenticated users via `/api/blob` (uses `BLOB_READ_WRITE_TOKEN`). Public access for AI services goes through `/api/media`, which is the only `/api/...` path allowed by the Clerk middleware.
- **AI-generated images** are mirrored from KIE's expiring CDN into Vercel Blob (`access: "public"` for `generated/tasks/*` and `generated/campaigns/*`, `private` for `generated/vouchers/*`).
- Two upload patterns:
  - Server-side `put()` for small files ≤ 4 MB (`/api/products/upload-file`, `/api/brand/logo`).
  - Client-side direct upload via `handleUpload` for larger files (`/api/products/upload`, `/api/upload`).

---

## Required environment variables

| Variable                           | Used by                                      |
| ---------------------------------- | -------------------------------------------- |
| `DATABASE_URL`                     | Neon Postgres (`drizzle.config.ts`, `src/db/index.ts`) |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk middleware + UI            |
| `BLOB_READ_WRITE_TOKEN`            | `/api/blob`, `/api/media`, `/api/download` for private Vercel Blob auth |
| `KIE_API_KEY`                      | All `/api/generate/*` and status routes      |
| `OPENROUTER_API_KEY`               | `/api/generate/text`, `/api/campaigns/suggest-topic` |
| `CRON_SECRET`                      | `/api/cron/autopost` bearer-token check      |
| `NEXT_PUBLIC_APP_URL` / `VERCEL_URL`| Build the public proxy URL handed to KIE so it can fetch private blobs |

---

## Local dev

```bash
npm run dev      # next dev (Turbopack)
npm run build
npm run start
npm run lint
```

Drizzle migrations live in `./drizzle`. Run with `drizzle-kit` (e.g. `npx drizzle-kit generate` / `migrate` / `push`) using `DATABASE_URL`.

---

## Conventions worth knowing

- **Money is integer สตางค์.** Always divide by 100 for display, multiply by 100 on write.
- **Brand DNA is the source of truth** for prompts. `tones`, `doSay`, `dontSay`, `primaryColor`, `tagline`, `audience` all flow into both image and text prompts.
- **`react.cache()`** is used in `src/lib/data.ts` to dedupe brand/products/vouchers/campaigns reads within a single request.
- **One brand per Clerk user** is currently enforced by upsert in `/api/brand`.
- **KIE temp URLs expire fast** — every place that receives a KIE URL mirrors it to Blob immediately.
- **Next.js 16 specifics**: middleware file is `src/proxy.ts`; route handler dynamic params are `Promise<{ id: string }>` and must be `await`ed.

See `api-spec.MD` for the full HTTP API surface.
