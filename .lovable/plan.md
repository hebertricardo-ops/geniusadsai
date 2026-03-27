

# Plano: Integrar geração de criativos via fal.ai nano-banana-pro/edit

## Resumo

Criar uma edge function `generate-creative` que usa `@fal-ai/client` para gerar criativos estáticos via `fal-ai/nano-banana-pro/edit`. Adicionar seletor de formato e ajustar limite de quantidade para 4. O prompt visual será construído no backend com base em todos os dados do stepper + ângulo/opção visual selecionados.

## Etapas

### 1. Solicitar FAL_KEY
- Usar a ferramenta de secrets para pedir a chave da fal.ai
- Necessária antes de qualquer implementação

### 2. Criar edge function `generate-creative`
Novo arquivo: `supabase/functions/generate-creative/index.ts`

- Receber via POST: `image_urls[]`, dados de copy (produto, promessa, dores, benefícios, objeções, CTA), ângulo selecionado (headline, body, cta, visual_option), formato (`1:1`, `4:5`, `9:16`, `16:9`), quantidade (1-4)
- Converter formato para dimensões em pixels (ex: `1:1` → 1024x1024, `4:5` → 1024x1280, `9:16` → 1024x1820, `16:9` → 1820x1024)
- Construir prompt visual estruturado no backend combinando:
  - Contexto do produto/oferta
  - Copy do ângulo selecionado
  - Orientações da opção visual (composição, hierarquia, layout, CTA highlight)
  - Instruções fixas: criativo estático publicitário, limpo, legível, premium, com área para textos, sem poluição visual
- Chamar `fal-ai/nano-banana-pro/edit` via `@fal-ai/client` com `num_images` = quantidade solicitada (máx 4)
- Retornar URLs das imagens geradas

### 3. Atualizar frontend (`CreateCreative.tsx`)

**Seletor de formato:**
- Adicionar estado `format` com opções: `1:1`, `4:5`, `9:16`, `16:9`
- Exibir como radio buttons ou cards visuais após seleção de ângulo/opção visual, antes do botão "Gerar Criativo"

**Limite de quantidade:**
- Alterar `max` de 5 para 4 no input de quantidade (step 0)
- Atualizar label e lógica de validação

**Fluxo `handleGenerateCreative`:**
1. Validar créditos suficientes (quantidade × 1 crédito)
2. Obter URLs públicas das imagens já uploadadas no storage
3. Chamar edge function `generate-creative` passando todos os dados
4. Salvar imagens retornadas no bucket `generated-creatives`
5. Registrar na tabela `generated_creatives` com `copy_data` do ângulo selecionado
6. Deduzir créditos e registrar transação
7. Exibir resultado ou redirecionar ao dashboard

### Detalhes técnicos

**Prompt visual interno (construído no backend):**
```text
Create a premium static ad creative for digital advertising.

Product: [nome]
Headline: [headline do ângulo]
Body: [body do ângulo]  
CTA: [cta do ângulo]

Visual direction: [visual_description da opção]
Layout: [layout_style]
Composition: [composition]
Visual hierarchy: [visual_hierarchy]
Element distribution: [element_distribution]
CTA highlight: [cta_highlight]

Rules:
- Compose a clean, professional static ad creative
- Use the provided reference images as base elements
- Maintain clear visual hierarchy and readability
- Reserve appropriate areas for text overlays
- Premium digital advertising atmosphere
- Highlight product/offer/benefit
- Improve composition, contrast and visual impact
- Avoid visual clutter
- Conversion-oriented professional look
```

**Dimensões por formato:**
- `1:1` → 1024×1024
- `4:5` → 1024×1280
- `9:16` → 1024×1820
- `16:9` → 1820×1024

**Dependências:** `@fal-ai/client` (importado via esm.sh no Deno edge function)

