

## Plano: Ajuste de layout da Dashboard

### Alterações

**1. Dashboard.tsx — Título e subtítulo personalizados**
- Substituir "Gere criativos que convertem" por `Olá, [Nome] 👋` usando `user?.user_metadata?.name` ou email como fallback, alinhado à esquerda.
- Manter `font-display` sem bold.
- Subtítulo "Pronto para criar anúncios que convertem?" com texto branco e fonte maior (`text-xl md:text-2xl text-white`).
- Mover o botão "Novo Criativo" para alinhamento à esquerda junto ao bloco de texto.

**2. Background mais escuro**
- Em `src/index.css`, escurecer `--background` de `222 47% 11%` para `222 47% 7%` e `--gradient-hero` proporcionalmente. Manter `--sidebar-background` inalterado.

**3. Substituir card "Expira em" por card "Dica Pro"**
- Remover o terceiro card do array (Clock/Expira em).
- Adicionar um card separado com estilo de destaque (borda laranja/primary, fundo com tom de primary) contendo:
  - Título: ícone `Lightbulb` + "Dica Pro" em cor primary.
  - Texto da dica em cor muted-foreground.

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/Dashboard.tsx` | Título personalizado, subtítulo, grid 2 colunas + card dica pro |
| `src/index.css` | `--background` mais escuro |

