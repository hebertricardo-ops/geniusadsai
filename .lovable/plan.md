

## Plano: Histórico Recente em Grid Portfolio com Carrossel

### Resumo
Transformar a seção "Histórico recente" de uma lista vertical para um layout de grid estilo portfólio (3 colunas × 2 linhas), buscando dados da tabela `generated_creatives` (que tem `image_url`) em vez de `creative_requests`. Adicionar animação de carrossel usando Embla (já disponível no projeto via `carousel.tsx`).

### Alterações em `src/pages/Dashboard.tsx`

**1. Nova query — buscar os 6 últimos criativos com imagem**
- Substituir a query `history` (que busca de `creative_requests`) por uma query em `generated_creatives` com join em `creative_requests` para obter `product_name`.
- Query: `generated_creatives` → `select("*, creative_requests(product_name)")` → `order("created_at", desc)` → `limit(6)`.

**2. Layout grid portfólio**
- Substituir o bloco de lista (`divide-y`) por um grid `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` com `gap-4` dentro de um container com `p-6`.
- Cada card será um componente estilizado com:
  - Imagem do criativo (`image_url`) com `aspect-ratio 4/5`, `object-cover`, `rounded-xl`, efeito hover com scale e overlay.
  - Overlay gradiente na parte inferior com: nome do produto, data (`dd/MM/yyyy`), créditos usados.
  - Sem badge de status.
  - Animação `animate-fade-in` com delay escalonado por índice.

**3. Carrossel (opcional, para mobile)**
- No mobile (1 coluna), usar os componentes `Carousel`, `CarouselContent`, `CarouselItem` já existentes para permitir swipe entre os 6 cards.
- No desktop, exibir o grid estático 3×2 (sem carrossel).

**4. Imports adicionais**
- Adicionar imports de `Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext` de `@/components/ui/carousel`.
- Remover import de `Image` do lucide (não mais usado como ícone placeholder).

### Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/pages/Dashboard.tsx` | Nova query `generated_creatives`, grid portfólio 3×2, carrossel mobile |

