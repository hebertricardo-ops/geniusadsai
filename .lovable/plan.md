## Plano: Reescrever a landing page do Genius ADS com a nova copy (9 dobras)

### Resumo

Reescrever completamente o conteúdo do `src/pages/Index.tsx` mantendo o mesmo layout system (gradient-hero, gradient-card, shadow-card, font-display, cores laranja/azul marinho, botões hero/outline, animações) mas expandindo de 5 seções para 9 dobras com toda a copy fornecida.  
  
Mantenha a barra superior com o nome do aplicativo "Genius" e os botões de "Entrar" e "Começar Grátis".  
Na dobra 1 mantenha os botões "Começar Agora" e "Ver Demo".

### Estrutura das Dobras

**Arquivo**: `src/pages/Index.tsx`

1. **Nav** — Mantém exatamente como está (logo + Entrar + Começar grátis)
2. **Dobra 1 — Hero** — Título "Crie criativos profissionais que vendem em segundos", subtítulo com a promessa, lista de 7 benefícios com emojis, CTA "Começar agora". Remover badge "Powered by AI" e botão "Ver demo". Adicionar grid de benefícios abaixo do CTA.
3. **Dobra 2 — Dor** — Fundo card escuro. Quotes estilizados em itálico/aspas com as 6 frases de dor. Texto de transição "Se você já pensou isso… o problema não é seu produto."
4. **Dobra 3 — Transição Dor → Solução** — Lista com ❌ dos problemas, seguido do texto "Você não precisa ser criativo. Você precisa de um sistema…" e menção ao Genius ADS.
5. **Dobra 4 — Passo a passo** — Reutiliza o layout atual de 4 steps (círculos gradient-primary numerados) com a nova copy: Envie imagens → Preencha → Clique em gerar → Baixe e use. Adicionar "Sem travar / Sem pensar demais / Sem perder tempo" abaixo.
6. **Dobra 5 — O que você recebe** — Grid 3x2 de cards (gradient-card) com ícones, títulos e descrições dos 6 itens.
7. **Dobra 6 — Para quem serve** — Duas colunas: ✅ "É pra você se" e ❌ "Não é pra você se", cada uma com lista de itens.
8. **Dobra 7 — Preços** — Grid de 4 cards de pricing (Free, Básico, Pro, Plus) com valores, preço por criativo e CTA principal.
9. **Dobra 8 — Custo de não comprar** — Seção texto com comparação "Hoje você…" vs "Com o Genius ADS você…"
10. **Dobra 9 — CTA Final + FAQ** — CTA com botão, seguido de Accordion/lista de FAQ com as 6 perguntas.
11. **Footer** — Atualiza "CreativeAI" para "Genius ADS" e ano para 2025.

### Detalhes Técnicos

- **Imports adicionais**: `Accordion, AccordionItem, AccordionTrigger, AccordionContent` de `@/components/ui/accordion` para o FAQ. Novos ícones do Lucide conforme necessário (Brain, Target, Upload, PenTool, Layers, etc.)
- **Padrões visuais reutilizados**: `gradient-card`, `shadow-card`, `gradient-primary`, `shadow-glow`, `text-gradient`, `font-display`, `text-muted-foreground`, botões `variant="hero"`
- **Responsividade**: Grids `grid-cols-1 md:grid-cols-2` ou `md:grid-cols-3` conforme o número de itens
- **Pricing cards**: Destaque no pacote Pro com `border-primary` e badge "Mais popular"
- **Nenhuma mudança** em CSS, rotas ou outros componentes