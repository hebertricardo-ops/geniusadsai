

## Plano: Aumentar Intervalos na Geração Sequencial de Imagens

### Problema Real

O código já usa um loop sequencial (`for` com `await`), mas o delay de **2 segundos** entre slides é insuficiente para a quota da API Vertex AI, resultando em erro 429 (RESOURCE_EXHAUSTED) a partir do slide 3-4.

### Mudanças

**1. Aumentar delay entre slides de 2s para 8s**

Na `handleImagesPhase` do `generate-carousel/index.ts`, linha 394:
- Alterar de `2000` para `8000` milissegundos entre cada slide
- Isso dá tempo suficiente para a quota da API se recuperar

**2. Aumentar delays de retry**

Linha 385: alterar o backoff de `5000 * Math.pow(2, attempt - 1)` para `10000 * Math.pow(2, attempt - 1)` com máximo de 60s:
- Retry 1: 10s de espera
- Retry 2: 20s de espera

**3. Adicionar log de progresso com timestamps**

Adicionar logs mais detalhados indicando quanto tempo cada slide levou e qual o delay aplicado, para facilitar debugging futuro.

### Arquivo Afetado

- `supabase/functions/generate-carousel/index.ts` (apenas a função `handleImagesPhase`, ~5 linhas alteradas)

