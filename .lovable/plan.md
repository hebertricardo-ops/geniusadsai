

## Plan: Migrate Creative Generator to fal.ai nano-banana-pro

### What Changes
**File: `supabase/functions/generate-creative/index.ts`** — Full rewrite of the image generation logic.

### Approach
Replace the Vertex AI (Google Service Account) integration with fal.ai's `nano-banana-pro/edit` endpoint, following the same proven pattern already used in `generate-carousel`.

### Changes in Detail

1. **Remove all Vertex AI / Google auth code**: Delete `base64url`, `getAccessToken`, `imageUrlToBase64` functions and the Google Service Account logic (~90 lines removed).

2. **Use `FAL_KEY` instead of `GOOGLE_SERVICE_ACCOUNT_JSON`**: The `FAL_KEY` secret is already configured.

3. **Replace image generation logic**:
   - Call `https://fal.run/fal-ai/nano-banana-pro/edit` (synchronous endpoint)
   - Send: `{ prompt, image_urls: [...referenceImageUrls], aspect_ratio }` 
   - Reference images are passed directly as URLs (no base64 conversion needed)
   - Extract result from `resultData.images[0].url`

4. **Download and re-upload to Supabase Storage**: After fal.ai generates the image URL, download it and upload to `generated-creatives` bucket (same pattern as carousel).

5. **Sequential generation with retry**: Generate images one at a time (not parallel) to avoid fal.ai rate limits (429). Include retry logic with backoff on 429 errors.

6. **Keep `buildPrompt` and format mapping unchanged** — the prompt structure stays the same, just flattened to a text string for fal.ai.

### No Frontend Changes
The response format (`{ images: [{ url }] }`) remains identical, so no client-side changes are needed.

