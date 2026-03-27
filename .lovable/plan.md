

## Tela de Resultados dos Criativos Gerados

### Visão Geral

Criar uma página dedicada (`/results/:requestId`) que exibe os criativos gerados após a conclusão do processo, substituindo o redirecionamento direto ao dashboard por uma experiência visual rica de resultados.

### Arquitetura

```text
CreateCreative (após geração)
  └─ navigate("/results/{requestId}")
       └─ CreativeResults.tsx
            ├─ Header (logo + voltar ao dashboard)
            ├─ Resumo da geração (produto, ângulo, formato)
            ├─ Galeria de imagens geradas
            │   └─ Cards com preview + download individual
            └─ Ações globais (download all, novo criativo)
```

### Etapas

**1. Nova página `src/pages/CreativeResults.tsx`**
- Recebe `requestId` via `useParams`
- Query à tabela `generated_creatives` filtrando por `request_id`
- Layout com header consistente (mesmo padrão do dashboard/create)
- Seção de resumo: nome do produto, ângulo escolhido, formato — extraído do campo `copy_data` (JSONB)
- Galeria responsiva (grid 1-2-3 colunas) com as imagens geradas
- Cada card mostra: thumbnail da imagem, botão de download individual
- Botão "Baixar todos" que faz download de todas as imagens em sequência
- Botão "Novo Criativo" que leva de volta a `/create`
- Estado vazio caso nenhum criativo seja encontrado

**2. Rota no `App.tsx`**
- Adicionar rota protegida: `/results/:requestId` → `<CreativeResults />`

**3. Redirecionamento pós-geração**
- Em `CreateCreative.tsx`, na função `handleGenerateCreative`, salvar o `request_id` ao inserir em `generated_creatives` e redirecionar para `/results/{requestId}` em vez de `/dashboard`
- Requer que a inserção em `generated_creatives` passe o `request_id` corretamente (campo já existe na tabela)

**4. Download de imagens**
- Download individual: `<a>` com atributo `download` apontando para a URL da imagem (bucket público `generated-creatives`)
- Download all: fetch + blob download sequencial para cada imagem

**5. Metadados da copy**
- Exibir do `copy_data` JSONB: `angle_name`, `headline`, `subheadline`, `body`, `cta`, `visual_option`, `format`
- Card de resumo acima da galeria com essas informações

### Detalhes Visuais
- Segue o tema existente: `gradient-hero` background, `gradient-card` para cards, `font-display` para títulos
- Animação `animate-fade-in` nos cards de resultado
- Badge de status no topo (ex: "✓ Geração concluída")
- Grid responsivo: 1 col mobile, 2 cols tablet, 3 cols desktop

