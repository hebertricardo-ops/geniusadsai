

## Plano Atualizado: Carrossel com Geração de Copy + Imagens dos Slides

### Resumo

A funcionalidade "Novo Carrossel" agora terá **duas etapas de geração**:
1. **Gerar copy** via OpenAI (igual ao plano anterior) — retorna headline, subtext, strategy para cada slide
2. **Gerar imagens** de cada slide via Google Vertex AI (Gemini) — usando as imagens de referência do usuário + a copy gerada como prompt, no mesmo padrão da `generate-creative`

O resultado final é um carrossel completo: copy estruturada + imagens prontas para cada slide.

### Arquitetura

```text
┌──────────────────┐     ┌─────────────────────┐     ┌────────────┐
│  CreateCarousel   │────▶│  generate-carousel   │────▶│  OpenAI    │
│  (formulário +    │     │  (edge function)     │     │  (copy)    │
│   upload imagens) │     │                      │────▶│  Vertex AI │
└───────┬──────────┘     │                      │     │  (imagens) │
        │                 └──────────┬──────────┘     └────────────┘
        ▼                            ▼
┌──────────────────┐     ┌──────────────────────┐
│ CarouselResults   │◀───│ carousel_requests     │
│ (slides visuais)  │    │ generated_creatives   │
└──────────────────┘     └──────────────────────┘
```

### Etapas de Implementação

**1. Criar tabela `carousel_requests`**

Migration com colunas: `id`, `user_id`, `product_name`, `main_promise`, `pain_points`, `benefits`, `objections`, `carousel_objective`, `creative_style`, `extra_context`, `slides_count`, `status`, `result_data` (jsonb — copy gerada), `created_at`. RLS: usuário CRUD próprios registros.

**2. Criar edge function `generate-carousel`**

Fluxo em duas fases dentro da mesma função:

- **Fase 1 — Copy (OpenAI)**: Usa o system prompt e user prompt do spec fornecido, com tool calling para forçar JSON estruturado. Retorna o array de slides com headline, subtext, strategy, cta.

- **Fase 2 — Imagens (Vertex AI / Gemini)**: Para cada slide, constrói um prompt visual combinando:
  - A copy do slide (headline + subtext + role)
  - As imagens de referência do usuário (convertidas para base64, mesmo padrão do `generate-creative`)
  - Estilo/tom informado pelo usuário
  - Formato fixo 1:1 (ou configurável)
  
  Reutiliza a mesma lógica de autenticação Google (service account JWT → access token) e chamada ao endpoint `gemini-3-pro-image-preview:generateContent` já implementada em `generate-creative`. Gera os slides em paralelo e faz upload ao bucket `generated-creatives`.

- **Retorno**: JSON com copy completa + array de URLs das imagens geradas (uma por slide).

**3. Criar página `CreateCarousel.tsx`**

Formulário com stepper de 3 etapas:
- **Etapa 1 — Produto**: Upload de imagens de referência (reutiliza componente `ImageUpload`), nome do produto, promessa, slider de quantidade de slides (4-8)
- **Etapa 2 — Persuasão**: Dores, benefícios, objeções (opcional)
- **Etapa 3 — Estratégia**: Objetivo do carrossel (select com 5 opções), estilo/tom, contexto extra

Ao submeter: valida créditos (custo = slides_count), cria registro, chama edge function, debita créditos, salva resultados, redireciona.

**4. Criar página `CarouselResults.tsx`**

Exibe o carrossel completo:
- Cada slide como card visual mostrando a **imagem gerada** com overlay da copy (headline, subtext)
- Indicador de slide_role e strategy em tooltip/badge
- Navegação horizontal (swipe/arrows) entre slides
- Botões: baixar todas as imagens, copiar copy completa, novo carrossel

**5. Atualizar navegação e rotas**

- Adicionar "Novo Carrossel" no `AppSidebar.tsx` (ícone `LayoutList`)
- Rotas: `/create-carousel` e `/carousel-results/:requestId` no `App.tsx`
- Registros de carrossel visíveis na página de Histórico

### Detalhes Técnicos

- **Créditos**: 1 crédito por slide (ex: 6 slides = 6 créditos)
- **Imagens de referência**: Até 4 imagens, upload ao bucket `creative-uploads`, URLs passadas à edge function
- **Geração de imagens**: Reutiliza `getAccessToken()`, `imageUrlToBase64()` e chamada Vertex AI do `generate-creative`, com prompt adaptado para contexto de slide de carrossel
- **Prompt de imagem por slide**: Inclui role do slide, headline, subtext, estilo visual e instrução para não renderizar texto na imagem
- **Modelo copy**: OpenAI via `OPENAI_API_KEY` (já configurado)
- **Modelo imagem**: Gemini `gemini-3-pro-image-preview` via `GOOGLE_SERVICE_ACCOUNT_JSON` (já configurado)
- **Armazenamento**: Imagens no bucket `generated-creatives`, registros na tabela `generated_creatives` com `request_id` apontando para `carousel_requests`

