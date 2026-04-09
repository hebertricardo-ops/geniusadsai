

## Plano: Barras de progresso animadas nos processos de geração

### Problema
Atualmente, durante os processos de geração (copy e imagens), o usuário vê apenas texto "Gerando..." ou um spinner pequeno, sem feedback claro de que o sistema está trabalhando. Isso pode parecer travamento.

### O que será feito
Criar um componente `GenerationProgress` reutilizável com barra de progresso animada, mensagens de status rotativas e indicação visual clara de atividade. Aplicar em todos os pontos de geração.

### Pontos de geração identificados

1. **CreateCreative — Geração de copy** (`loading = true`, ~10-20s)
2. **CreateCreative — Geração de imagem** (`generatingCreative = true`, ~30-60s)
3. **CreateCarousel — Geração de copy** (`loadingCopy = true`, ~10-20s)
4. **CreateCarousel — Geração de slide individual** (`slideStates[idx].loading = true`, ~20-40s)

### Alterações

**1. Novo componente `src/components/GenerationProgress.tsx`**
- Barra de progresso animada com progresso simulado (avança gradualmente até ~90%, completa ao finalizar)
- Mensagens de status rotativas contextuais (ex: "Analisando seu produto...", "Criando composição visual...", "Finalizando criativo...")
- Ícone de Sparkles animado com pulse
- Tempo estimado restante
- Props: `isActive`, `type` ("copy" | "creative" | "carousel-slide"), `onComplete?`

**2. `src/pages/CreateCreative.tsx`**
- Substituir "Gerando..." no botão de copy por overlay/seção com `GenerationProgress` tipo "copy"
- Substituir "Gerando..." no botão de criativo por `GenerationProgress` tipo "creative" em tela cheia dentro do card
- Desabilitar interações durante geração

**3. `src/pages/CreateCarousel.tsx`**
- Ao gerar copy: exibir `GenerationProgress` tipo "copy" substituindo o formulário temporariamente
- Ao gerar slide individual: exibir `GenerationProgress` tipo "carousel-slide" dentro do card do slide (substituindo o botão)

### Detalhes técnicos

O progresso será simulado com `useEffect` + `setInterval`:
- 0-60%: avanço rápido (primeiros 10s)
- 60-85%: avanço lento (próximos 20s)  
- 85-95%: muito lento (espera)
- 95-100%: só quando a resposta chegar

Mensagens rotativas a cada 4 segundos, específicas por tipo de geração.

