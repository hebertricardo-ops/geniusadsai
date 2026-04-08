

## Plano: Geração Individual de Slides com Revisão de Copy

### Resumo

Mudar o fluxo para que cada slide tenha seu próprio botão de geração de imagem, eliminando o problema de timeout/quota ao gerar múltiplas imagens numa única chamada. A copy é salva no histórico imediatamente após geração.

### Novo Fluxo

```text
Formulário (3 steps) → Gerar Copy → Salva no histórico (status: "copy_ready")
                                   → Exibe cards com copy de cada slide
                                   → Cada card tem: upload de imagens extras + botão "Gerar Slide"
                                   → Usuário gera 1 slide por vez (1 crédito cada)
                                   → Ao gerar, salva imagem em generated_creatives
```

### Etapas de Implementação

**1. Atualizar Edge Function `generate-carousel`**

Adicionar `phase: "single-image"` que gera apenas **1 slide** por chamada. Recebe: `slide` (objeto com headline/subtext/role), `image_urls`, `product_name`, `creative_style`, `total_slides` (para contexto de posição), `carousel_style_reference` (descrição do estilo visual do carrossel para manter consistência entre slides). Remove a fase `"images"` (batch).

Para garantir consistência visual entre slides, o prompt incluirá instruções explícitas de estilo compartilhado (paleta de cores, estilo de fundo, tipo de composição) derivadas do `creative_style` e das imagens de referência.

**2. Refatorar `CreateCarousel.tsx`**

Após gerar a copy:
- Salvar imediatamente no banco (`carousel_requests` com `status: "copy_ready"` e `result_data` com a copy)
- Exibir os cards de cada slide com:
  - Badge de role, headline, subtext, strategy
  - Componente `ImageUpload` individual (imagens extras por slide)
  - Botão "Gerar Imagem" (1 crédito) por slide
  - Estado de loading individual por slide
  - Preview da imagem gerada quando pronta
  - Botão de regenerar imagem (se já gerada)
- As imagens de referência do formulário original são enviadas como base para todos os slides
- Imagens extras por slide são adicionadas ao array de referência daquele slide específico

**3. Atualizar `CarouselResults.tsx`**

- Buscar slides do `generated_creatives` + copy do `carousel_requests.result_data`
- Tratar slides sem imagem (copy gerada mas imagem não gerada ainda) — mostrar placeholder
- Permitir navegar para a página de edição para gerar slides faltantes

**4. Créditos**

- Debitar 1 crédito por slide no momento da geração individual
- Gerar copy continua gratuito
- Validar saldo antes de cada geração individual

### Detalhes Tecnicos

- **Consistência visual**: O prompt de cada slide incluirá um bloco `estilo_global_do_carrossel` com: paleta derivada do estilo escolhido, tipo de background, elementos visuais recorrentes. Todas as imagens de referência originais são enviadas em todos os slides.
- **Estado por slide**: Array `slideStates` com `{ loading: boolean, imageUrl: string | null, extraImages: File[] }` para cada slide
- **Edge function**: A fase `"single-image"` reutiliza a mesma lógica de `generateSlideImage` já existente, mas para 1 slide apenas (sem loop, sem delay)
- **Upload de imagens extras**: Usa o mesmo componente `ImageUpload` já existente, com `maxImages={4}`
- **Arquivo afetados**: `generate-carousel/index.ts`, `CreateCarousel.tsx`, `CarouselResults.tsx`

