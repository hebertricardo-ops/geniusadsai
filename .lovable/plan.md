

## Plano: Corrigir Erro de Timeout + Fluxo de Seleção de Copy no Carrossel

### Problema Identificado

Os logs mostram que a edge function **completou com sucesso** ("Successfully generated carousel with 6 slides"), mas a conexão HTTP foi encerrada antes da resposta chegar ao cliente: `Http: connection closed before message completed`. Isso acontece porque a geração de 6 imagens via Vertex AI leva vários minutos, causando timeout na conexão do browser.

### Solução

Separar o fluxo em **duas fases** (igual ao fluxo de criativos):

1. **Fase 1 - Gerar Copy**: Chamar a edge function apenas para gerar a copy via OpenAI (rápido, ~5s). Apresentar os slides gerados ao usuário para revisão/confirmação.

2. **Fase 2 - Gerar Imagens**: Após o usuário confirmar a copy, chamar a edge function novamente para gerar as imagens dos slides (operação longa). Isso resolve o timeout porque o usuário confirma antes da parte pesada.

### Etapas

**1. Dividir a edge function `generate-carousel` em duas operações**

Adicionar um parâmetro `phase` no request body:
- `phase: "copy"` - Executa apenas a Fase 1 (OpenAI). Retorna o JSON da copy gerada em ~5s. Sem timeout.
- `phase: "images"` - Recebe a copy já aprovada + image_urls. Gera imagens via Vertex AI e faz upload. Retorna URLs dos slides.

**2. Atualizar `CreateCarousel.tsx` com fluxo de seleção**

Após submeter o formulário:
1. Chama `generate-carousel` com `phase: "copy"` 
2. Exibe os slides gerados (headline, subtext, strategy, slide_role) em cards para o usuário revisar
3. Usuário confirma ou regenera
4. Ao confirmar, chama `generate-carousel` com `phase: "images"` passando a copy aprovada
5. Mostra loading durante geração de imagens
6. Redireciona para resultados

A UI de revisão da copy seguirá o padrão visual do `CreateCreative.tsx`: cards com os slides numerados, badges de slide_role, headline em destaque, subtext e strategy visíveis.

**3. Ajustar gerenciamento de créditos**

- Créditos debitados apenas na Fase 2 (geração de imagens), não na geração de copy
- Isso evita cobrar o usuário se ele desistir após ver a copy

### Detalhes Tecnicas

- **Edge function**: Mesma função, roteada pelo campo `phase`
- **Timeout**: Fase 1 retorna em ~5s. Fase 2 pode levar 2-3 min mas o usuário já sabe o que esperar
- **Fallback**: Se Fase 2 falhar parcialmente, salvar os slides que foram gerados com sucesso

