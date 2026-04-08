

## Plan: Generate Missing Slide Images from Carousel Results Page

### Problem
When a carousel has slides without images (partial generation or copy_ready status), the user must go back to the creation flow to generate them. We need to allow generating missing slide images directly from the CarouselResults page while maintaining visual consistency.

### Approach

#### 1. Store Visual Context in carousel_requests
Add a `visual_context` JSONB column to `carousel_requests` to persist the style, reference image URLs, and product context at creation time. This ensures slides generated later use the same visual parameters.

**Migration:**
```sql
ALTER TABLE carousel_requests 
ADD COLUMN visual_context jsonb DEFAULT NULL;
```

#### 2. Save Visual Context During Creation (CreateCarousel.tsx)
After copy generation succeeds and the carousel request is saved, also store the `visual_context` object containing:
- `creative_style` (selected style)
- `image_urls` (uploaded reference image URLs)
- `product_name`
- `carousel_style_reference`

This happens once at copy generation time, so all future image generations reference the same visual parameters.

#### 3. Add "Generate Image" Button on CarouselResults Page
For each slide without an image (`!currentCreative`), show a "Gerar Imagem (1 crédito)" button. Also add an "Upload" vs "Gerar com IA" toggle, mirroring the CreateCarousel flow.

**Key UI additions in CarouselResults.tsx:**
- Import `useCredits`, `useQueryClient`, `ImageUpload`, and relevant icons
- Add state for `generatingSlides` (tracks which slide indices are loading) and `slideOptions` (upload vs AI per slide)
- On the slide detail panel (right side), when no image exists, render the toggle + generate button
- On thumbnails, show a "+" overlay for missing slides

#### 4. Generate Image Handler in CarouselResults
Create `handleGenerateSlideImage(slideIndex)` that:
1. Reads `visual_context` from the carousel request (style, reference images)
2. Calls `supabase.functions.invoke("generate-carousel", { phase: "single-image", ... })` with the same parameters used during creation
3. Saves the result to `generated_creatives`
4. Deducts 1 credit (fresh fetch pattern)
5. Logs the credit transaction
6. Invalidates queries to refresh the UI
7. If all slides now have images, updates request status to "completed"

#### 5. Visual Consistency Mechanisms
- **Stored reference images**: The `visual_context.image_urls` are persisted so the same references are sent to Vertex AI regardless of when generation happens
- **Stored style**: `creative_style` is locked at creation time
- **Existing prompt instructions**: The edge function already includes "manter consistência visual com os outros slides do carrossel" and the `estilo_global_do_carrossel` block
- **Pass existing slide images as additional context**: When generating a missing slide, also send 1-2 already-generated slide image URLs as extra visual references so Vertex AI can match the established look

#### 6. Enhanced Edge Function (generate-carousel/index.ts)
Add support for an optional `existing_slide_urls` parameter in the `single-image` phase. When provided, these are included as additional reference images alongside the original product references, giving Vertex AI concrete visual examples of the carousel's established style.

Add a new instruction in the prompt:
```
"REFERÊNCIA DE ESTILO: as imagens de referência incluem slides já gerados deste carrossel. 
Mantenha EXATAMENTE a mesma paleta de cores, estilo tipográfico, elementos decorativos e composição visual."
```

### Files to Modify
1. **Migration** — Add `visual_context` column to `carousel_requests`
2. **src/pages/CreateCarousel.tsx** — Save `visual_context` when creating the request
3. **src/pages/CarouselResults.tsx** — Add generate UI + handler for missing slides
4. **supabase/functions/generate-carousel/index.ts** — Accept `existing_slide_urls` for style consistency

