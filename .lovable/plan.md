

## Plan: Enforce Font Consistency Across Carousel Slides

### Problem
Slides 2, 4 and 5 of the last carousel were generated with different font-family styles than the remaining slides. Since Vertex AI generates each slide image independently, there's no built-in mechanism to enforce the same typography across all slides.

### Root Cause
The current prompts mention "tipografia legível" and "consistência visual" but never specify a concrete font-family or typographic style. Vertex AI interprets this loosely, choosing different fonts per slide.

### Solution
Add explicit, rigid typography instructions to both image generation phases (batch `images` and `single-image`) that lock the font to a single named style and describe it precisely enough for Vertex AI to replicate consistently.

### Changes

#### 1. Edge Function — `supabase/functions/generate-carousel/index.ts`

**Both `handleImagesPhase` and `handleSingleImagePhase`** — add a dedicated `tipografia` block to the JSON prompt (alongside `instrucoes_de_composicao`):

```json
"tipografia": {
  "regra_principal": "TODOS os slides do carrossel DEVEM usar EXATAMENTE a mesma fonte/estilo tipográfico. Consistência tipográfica é OBRIGATÓRIA.",
  "headline": "sans-serif geométrica bold (estilo Montserrat Bold ou similar). Todas as headlines devem usar a MESMA fonte em TODOS os slides.",
  "subtexto": "sans-serif regular/light (estilo Montserrat Regular ou similar). Todos os subtextos devem usar a MESMA fonte em TODOS os slides.",
  "cta": "mesma família tipográfica do headline, em bold ou semibold",
  "proibicoes": [
    "PROIBIDO usar fontes serifadas em qualquer slide",
    "PROIBIDO variar o estilo tipográfico entre slides",
    "PROIBIDO usar fontes manuscritas, cursivas ou decorativas",
    "PROIBIDO misturar famílias tipográficas diferentes entre slides"
  ]
}
```

Also add to the `instrucoes_de_composicao` array:
- `"TIPOGRAFIA: usar EXATAMENTE a mesma fonte sans-serif geométrica bold para headlines e sans-serif regular para subtextos em TODOS os slides. NÃO variar a font-family entre slides."`

**When `existing_slide_urls` are provided** (generating a missing slide later), reinforce:
- `"COPIAR EXATAMENTE a mesma tipografia (font-family, peso, tamanho relativo) dos slides de referência já gerados. A fonte deve ser idêntica."`

#### 2. Visual Context Enhancement — `src/pages/CreateCarousel.tsx`

When saving the `visual_context` object, also store a `typography_style` field:
```ts
typography_style: "sans-serif geométrica (Montserrat ou similar)"
```

This way, when generating missing slides from the results page, the stored typography preference is sent to the edge function.

#### 3. Results Page — `src/pages/CarouselResults.tsx`

When calling `generate-carousel` for a missing slide, pass the `typography_style` from `visual_context` so it gets included in the prompt.

### Files to Modify
1. **`supabase/functions/generate-carousel/index.ts`** — Add `tipografia` block + reinforce font instructions in both image generation phases
2. **`src/pages/CreateCarousel.tsx`** — Store `typography_style` in `visual_context`
3. **`src/pages/CarouselResults.tsx`** — Pass `typography_style` when generating missing slides

### Impact
- No layout changes
- No database migration needed (uses existing JSONB column)
- Prompts become significantly more prescriptive about font consistency

