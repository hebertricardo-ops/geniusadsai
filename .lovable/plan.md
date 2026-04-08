

## Plan: Integrate fal.ai (nano-banana-pro/edit) as Primary Image Generator for Carousel

### Overview
Add fal.ai as the primary image generation method for carousel slides, keeping Vertex AI as a fallback in standby. The `FAL_KEY` secret is already configured.

### How it Works

The fal.ai REST API flow:
1. **Submit** a request to `https://queue.fal.run/fal-ai/nano-banana-pro/edit` with prompt + reference image URLs
2. **Poll** for status at `https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests/{request_id}/status`
3. **Retrieve** result at `https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests/{request_id}`

The edit endpoint accepts `image_urls` (array of reference image URLs) and a `prompt` string — no base64 conversion needed (fal accepts URLs directly).

### Changes

#### 1. Edge Function — `supabase/functions/generate-carousel/index.ts`

**Add a new function `generateSlideWithFal()`:**
- Takes the same slide data, prompt info, and reference image URLs
- Builds a text prompt from the existing prompt JSON (same content: typography rules, composition instructions, product context)
- Calls fal.ai queue API: submit → poll → get result
- Returns the generated image URL directly (fal returns hosted URLs, no base64 needed)
- Downloads the image from fal.ai URL and re-uploads to Supabase Storage for persistence

**Add a provider selection constant:**
```typescript
const IMAGE_PROVIDER = "fal"; // "fal" | "vertex"
```

**Modify `handleImagesPhase()`:**
- Check `IMAGE_PROVIDER`
- If `"fal"`: use `generateSlideWithFal()` for each slide (sequential, with retry logic)
- If `"vertex"`: use existing Vertex AI logic (unchanged)

**Modify `handleSingleImagePhase()`:**
- Same provider check — route to fal.ai or Vertex AI accordingly

**fal.ai-specific details:**
- Auth header: `Authorization: Key ${FAL_KEY}`
- Input schema for edit endpoint: `{ prompt, image_urls, aspect_ratio: "1:1" }`
- The prompt will be a flattened text version of the same JSON prompt structure already used (typography rules, slide content, composition instructions)
- Poll interval: 2s, max attempts: 60 (2 min timeout)
- Retry on failure: 2 retries with 5s backoff

#### 2. No Frontend Changes
The frontend doesn't need to know which provider is used — the edge function API contract remains identical.

### Files to Modify
1. **`supabase/functions/generate-carousel/index.ts`** — Add fal.ai integration, provider toggle, keep Vertex AI intact

### Rollback
Switching back to Vertex AI is a single constant change: `IMAGE_PROVIDER = "vertex"`.

