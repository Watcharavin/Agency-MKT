# Agency-MKT — API Spec

All routes are **Next.js 16 App Router Route Handlers** under `src/app/api/`. Unless noted, every route requires a Clerk session (`auth()` from `@clerk/nextjs/server`) and returns `401 Unauthorized` otherwise. Most write routes also resolve the caller's brand by `userId` and return `404 Brand not found` if no brand exists.

Conventions:
- Request and response bodies are JSON unless explicitly `multipart/form-data`.
- Money fields (`price`) use **integer สตางค์** in the DB. The product write endpoints accept decimal บาท and convert (`Math.round(price * 100)`).
- Path params are typed `Promise<{ id: string }>` per Next 16; they're awaited inside the handler.
- The only public `/api/*` path is **`/api/media`** (allow-listed in `src/proxy.ts`).

---

## Auth

There is no API surface for auth — Clerk handles `/sign-in` and `/sign-up` through its catch-all route components. Sessions are read on the server with `auth()` and on the client with Clerk hooks.

---

## Brand

### `GET /api/brand`
Return the current user's brand (or `null`).
- **Response 200**: `Brand | null`

### `POST /api/brand`
Upsert the current user's brand (one brand per user).
- **Body**:
  ```json
  {
    "name": "string (required)",
    "tagline": "string?",
    "about": "string?",
    "audience": "string?",
    "primaryColor": "#hex?",
    "secondaryColor": "#hex?",
    "thirdColor": "#hex?",
    "logoUrl": "string? (Vercel Blob URL)",
    "toneTags": ["string"],
    "channels": ["string"],
    "languages": ["string"],
    "doSay": "string?",
    "dontSay": "string?",
    "displayFont": "string?",
    "bodyFont": "string?",
    "socialLinks": {
      "facebook?": "string", "instagram?": "string", "tiktok?": "string",
      "tiktokShop?": "string", "line?": "string", "lineUrl?": "string",
      "shopee?": "string", "phone?": "string"
    }
  }
  ```
- **Response 200**: `{ ok: true }`
- **Errors**: 400 `name required`

### `POST /api/brand/logo`
Server-side logo upload (private blob, ≤ 4 MB).
- **Body**: `multipart/form-data` with `file` (`image/jpeg|png|webp`)
- **Response 200**: `{ url: string }` — Vercel Blob URL stored under `brand/<userId>-<ts>-<filename>`
- **Errors**: 400 `No file`, 500 `put failed`

---

## Products

### `GET /api/products`
List products for the current user's brand.
- **Response 200**: `Product[]` (empty array if no brand)

### `POST /api/products`
Create a product.
- **Body**:
  ```json
  {
    "name": "string (required)",
    "sku": "string?",
    "price": "number? (in บาท, converted to สตางค์)",
    "description": "string?",
    "category": "string?",
    "tags": ["string"],
    "photoUrls": ["string"]
  }
  ```
- **Response 200**: `{ ok: true, id: string }`
- **Errors**: 400 `name required`, 404 `Brand not found`

### `PATCH /api/products/[id]`
Update a product owned by the caller's brand.
- **Body**: same shape as POST (all fields replace).
- **Response 200**: `{ ok: true, product: Product }`
- **Errors**: 404 `Brand not found`, 404 `Product not found`

### `DELETE /api/products/[id]`
Delete a product owned by the caller's brand.
- **Response 200**: `{ ok: true }`
- **Errors**: 404 `Brand not found`

### `POST /api/products/upload`
Client-side **direct upload to Vercel Blob** (Vercel `handleUpload` flow). Use this for any file > 4 MB.
- **Body**: `HandleUploadBody` (Vercel SDK; client posts `type: "blob.generate-client-token"` then completion notification)
- **Allowed content types**: `image/jpeg`, `image/png`, `image/webp`
- **Response 200**: depends on stage — token JSON, then completion ACK.

### `POST /api/products/upload-file`
Server-side product photo upload (private blob, ≤ 4 MB).
- **Body**: `multipart/form-data` with `file`
- **Allowed content types**: `image/jpeg`, `image/png`, `image/webp`, `image/jpg`
- **Response 200**: `{ url: string }` — `products/<ts>-<filename>`
- **Errors**: 400 `No file` / `ไฟล์ไม่รองรับ`, 500 on Blob put failure.

---

## Campaigns

### `GET /api/campaigns`
List campaigns for the caller's brand.
- **Response 200**: `Campaign[]`

### `POST /api/campaigns`
Create a draft campaign.
- **Body**:
  ```json
  {
    "channel": "Facebook | Instagram | LINE | TikTok (required)",
    "topic": "string (required)",
    "productId": "string?",
    "brief": "string?",
    "audience": "string?",
    "tone": "string? (default Educational)",
    "language": "string? (default TH)",
    "slideCount": "number? (default 3)",
    "imageRatio": "string? (default 1:1)",
    "pillar": "string?",
    "goal": "string?",
    "cta": "string?",
    "captionLength": "Short | Medium | Long (default Medium)",
    "footerStyle": "Full | Min | Shopee | LINE | ไม่ใส่ (default Full)"
  }
  ```
- **Response 200**: `{ ok: true, id: string }`
- **Errors**: 400 `channel and topic required`, 404 `Brand not found`

### `GET /api/campaigns/[id]`
Get a campaign + its generated assets.
- **Response 200**: `{ campaign: Campaign, assets: GeneratedAsset[] }`
- **Errors**: 404 `Brand not found` / `Not found`

### `PATCH /api/campaigns/[id]`
Update a subset of campaign fields. Allowed: `topic, brief, audience, tone, language, slideCount, imageRatio, pillar, goal, cta, captionLength, footerStyle, channel, productId, status, scheduledAt`. `scheduledAt` is parsed with `new Date(...)`.
- **Response 200**: `{ ok: true }`

### `DELETE /api/campaigns/[id]`
Delete a campaign.
- **Response 200**: `{ ok: true }`

### `POST /api/campaigns/[id]/assets`
Replace the campaign's generated assets with a fresh batch (called after KIE images finish + caption is written). Mirrors all KIE URLs into Vercel Blob (`generated/campaigns/<id>/slide-<i>.jpg`, `access: public`) before saving. Sets campaign `status` → `generated`.
- **Body**:
  ```json
  {
    "imageUrls": ["string"],
    "caption": "string",
    "hashtags": "string"
  }
  ```
- **Response 200**: `{ ok: true }`
- **Errors**: 404 `Brand not found` / `Campaign not found`

### `POST /api/campaigns/[id]/post`
Post the campaign immediately to its corresponding active social account (`channel` mapped → `platform`). Reads stitched caption (`caption + "\n\n" + hashtags`) and slide-0 image from `generated_assets`. Writes a row to `post_logs` per attempt and flips campaign `status` → `published`.
- **Response 200**:
  ```json
  {
    "ok": true,
    "results": [
      { "platform": "line|facebook|instagram", "status": "success|failed",
        "postUrl": "string?", "error": "string?" }
    ]
  }
  ```
- **Errors**: 400 `Unsupported channel`, 400 `No <Channel> account connected`, 400 `No content to post`, 404 `Brand not found` / `Campaign not found`

### `POST /api/campaigns/suggest-topic`
Generate **4 Thai topic ideas** via OpenRouter Claude Haiku 4.5.
- **Body**:
  ```json
  {
    "platform": "Facebook | Instagram | LINE | TikTok",
    "pillar": "string (e.g. Knowledge | Product | Brand | Promotion)",
    "goal": "string (e.g. Awareness | Conversion)",
    "productId": "string?"
  }
  ```
- **Response 200**: `{ topics: string[] }` (up to 4)
- **Errors**: 500 `OPENROUTER_API_KEY not set`, 500 `AI generation failed`

---

## AI Generation

### `POST /api/generate/text`
Generate a Thai caption + hashtags for a campaign and assemble it with brand signature / shop links / footer (per `footerStyle`).
- **Body**: `{ "campaignId": "string" }`
- **Response 200**: `{ caption: string, hashtags: string, footer: string }`
- Backed by OpenRouter Claude Haiku 4.5 (`max_tokens: 1500`).
- **Errors**: 400 `campaignId required`, 404 `Brand not found` / `Campaign not found`, 500 `OPENROUTER_API_KEY not set`

### `POST /api/generate/campaign`
Kick off **N KIE image-generation tasks** for a campaign (one per slide). Sets campaign `status` → `generating`. On any task failure resets to `draft`.
- **Body**:
  ```json
  {
    "campaignId": "string (required)",
    "slideRatios": ["1:1" | "9:16" | "16:9" | "4:3" | "3:4"],
    "caption": "string? (used as image-context summary)"
  }
  ```
- **Response 200**: `{ ok: true, taskIds: string[], slideCount: number }`
- Aspect ratio defaults from channel (FB 16:9, IG/LINE 1:1, TikTok 9:16) if not provided.
- **Errors**: 400 `campaignId required`, 404, 500 (KIE error)

### `POST /api/generate/voucher`
Kick off KIE tasks for a voucher collection: **1 cover** + **1 collection (merged) image** + **1 image per coupon**.
- **Body**:
  ```json
  {
    "voucherId": "string (required)",
    "prompt": "string?",
    "tones": ["string"],
    "slogan": "string?"
  }
  ```
- **Response 200**:
  ```json
  {
    "ok": true,
    "voucherId": "string",
    "tasks": [
      { "label": "voucher_cover|collection|coupon", "couponId": "string?", "taskId": "string" }
    ]
  }
  ```
- Brand logo (if set) is prepended to KIE `input_urls` so the model treats it as identity reference.

### `GET /api/generate/status/[taskId]`
Poll KIE for a task's status. **When the task completes, the result image is immediately mirrored** to Vercel Blob (`generated/tasks/<taskId>.jpg`, `access: public`) before being returned, because KIE URLs expire quickly.
- **Response 200**:
  ```json
  {
    "taskId": "string",
    "status": "pending | completed | failed",
    "imageUrl": "string | null"
  }
  ```
- **Errors**: 500 `KIE_API_KEY not set`, 502 `KIE getTask failed`

---

## Vouchers (Super-AFF)

### `GET /api/vouchers`
List voucher collections for the caller's brand.
- **Response 200**: `VoucherCollection[]`

### `POST /api/vouchers`
Create a voucher collection plus its coupons.
- **Body**:
  ```json
  {
    "name": "string (required)",
    "caption": "string?",
    "mergeMode": "auto | product_photos (default auto)",
    "valueCap": "string?",
    "status": "draft | active (default draft)",
    "validFrom": "ISO date string?",
    "validUntil": "ISO date string?",
    "coupons": [
      { "name": "string", "productId": "string?", "code": "string?", "discount": "string?" }
    ]
  }
  ```
- **Response 200**: `{ ok: true, id: string }` (the new collection id)
- **Errors**: 400 `name required`, 404 `Brand not found`

### `PATCH /api/vouchers/[id]`
Update a voucher collection. **Replaces all coupons** (deletes existing, inserts new from the body).
- **Body**: same shape as POST.
- **Response 200**: `{ ok: true }`

### `DELETE /api/vouchers/[id]`
Delete a voucher collection (cascade deletes its coupons).
- **Response 200**: `{ ok: true }`

### `POST /api/vouchers/[id]/save-images`
Persist KIE-generated images for a voucher (cover, collection-merged, per-coupon). Mirrors KIE temp URLs into Vercel Blob (`generated/vouchers/<id>/<label>-<i>.jpg`, `access: private`).
- **Body**:
  ```json
  {
    "images": [
      { "label": "voucher_cover | collection | coupon", "couponId": "string?", "imageUrl": "string" }
    ]
  }
  ```
- **Response 200**: `{ ok: true, saved: number }`
- **Errors**: 404 `Brand not found` / `Voucher not found`

---

## Social accounts

### `GET /api/social-accounts`
List the connected social accounts for the caller's brand (no token fields returned).
- **Response 200**:
  ```json
  {
    "accounts": [
      { "id": "string", "platform": "line|facebook|instagram|x|tiktok",
        "platformAccountId": "string?", "platformAccountName": "string?",
        "isActive": 0|1, "createdAt": "Date" }
    ]
  }
  ```

### `POST /api/social-accounts`
Connect (or replace) a social account. Any existing account on the same platform is **deactivated** (`isActive = 0`) before the new one is inserted.
- **Body**:
  ```json
  {
    "platform": "line | facebook | instagram | x | tiktok",
    "accessToken": "string (required)",
    "platformAccountId": "string?",
    "platformAccountName": "string?"
  }
  ```
- **Response 200**: `{ ok: true, id: string }`
- **Errors**: 400 `platform and accessToken required`, 404 `Brand not found`
- ⚠️ Tokens are stored **unencrypted** today — `// TODO: encrypt before storing`.

### `DELETE /api/social-accounts?id=<accountId>`
Hard-delete a social account belonging to the caller's brand.
- **Query**: `id` (required)
- **Response 200**: `{ ok: true }`
- **Errors**: 400 `id required`, 404 `Brand not found`

---

## Cron

### `GET /api/cron/autopost`
Triggered by Vercel Cron (`vercel.json`: `0 9 * * *`). Bearer-auth via `CRON_SECRET`. Walks every campaign with `status = "scheduled"` and `scheduledAt <= now`, posts each to its matching active social account(s), writes `post_logs`, and flips campaign `status` → `published`.
- **Headers**: `Authorization: Bearer <CRON_SECRET>`
- **Response 200**: `{ posted: number, errors?: string[] }`
- **Errors**: 401 `Unauthorized`

---

## Blob / Media / Download

### `POST /api/upload`
Generic client-side direct upload — same shape as `/api/products/upload` (Vercel `handleUpload`). Used by `BrandDNAForm`, etc.
- Auth required.

### `POST /api/blob`
**This is `GET /api/blob?url=...`** — fetches a *private* Vercel Blob and streams it to the authenticated user. Uses `BLOB_READ_WRITE_TOKEN` to authenticate the upstream fetch. `Cache-Control: private, max-age=3600`.
- **Query**: `url` (required, the private Blob URL)
- **Auth**: required
- **Response 200**: image bytes
- **Errors**: 400 `Missing url`, 401 `Unauthorized`, 404 `Not found`

### `GET /api/media?url=<blobUrl>`
**Public** proxy — only path under `/api/*` not protected by Clerk middleware. Whitelists URLs containing `blob.vercel-storage.com`. Used so external services (KIE) can fetch private product photos. `Cache-Control: public, max-age=86400`.
- **Query**: `url` (required)
- **Response 200**: image bytes
- **Errors**: 400 `Missing url`, 403 `Forbidden` (URL not on Vercel Blob), 404 `Not found`, 500 on fetch error.

### `GET /api/download?url=<url>&name=<filename>`
Streams an image with `Content-Disposition: attachment` so the browser triggers Save-As. Adds the Blob bearer header automatically when the URL is on `blob.vercel-storage.com`.
- **Query**: `url` (required), `name` (optional, default `image.jpg`)
- **Response 200**: image bytes (attachment).
- **Errors**: 400 `Missing url`, 404 `Not found`, 500 on fetch error.
- Note: this route is currently behind Clerk middleware (not in the public allow-list).

---

## End-to-end flows

### Generate a campaign
1. `POST /api/campaigns` → draft id.
2. `POST /api/generate/text { campaignId }` → caption + hashtags.
3. `POST /api/generate/campaign { campaignId, slideRatios, caption }` → KIE `taskIds[]`. Campaign status → `generating`.
4. Client polls `GET /api/generate/status/[taskId]` for each task until `completed`. Each completion mirrors the KIE URL → Vercel Blob.
5. `POST /api/campaigns/[id]/assets { imageUrls, caption, hashtags }` → persists assets, status → `generated`.
6. Either `POST /api/campaigns/[id]/post` (manual) or set `status = "scheduled"` + `scheduledAt` via PATCH and let the daily cron post it.

### Generate a voucher pack
1. `POST /api/vouchers` → collection id (with coupons).
2. `POST /api/generate/voucher { voucherId, prompt, tones, slogan }` → `tasks[]` (cover + collection + per-coupon).
3. Client polls `GET /api/generate/status/[taskId]` per task.
4. `POST /api/vouchers/[id]/save-images { images: [{ label, couponId?, imageUrl }] }` → mirrors and saves.

### Connect a social account and post
1. `POST /api/social-accounts { platform, accessToken, platformAccountId, platformAccountName }` (any prior account on that platform is deactivated).
2. With a campaign that has assets, `POST /api/campaigns/[id]/post` to publish immediately, or schedule + wait for the cron.
