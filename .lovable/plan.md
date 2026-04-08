

## Plano: Substituir iframe do YouTube por player customizado

### Problema
O YouTube não respeita consistentemente o `controls=0` em iframes embarcados. É uma limitação conhecida da API.

### Solução
Substituir o iframe por uma **thumbnail estática com botão de play customizado**. Ao clicar, o iframe carrega com `autoplay=1&controls=0`. Isso garante:
- Visual limpo sem controles visíveis antes do play
- O vídeo inicia automaticamente ao clicar
- Após o play, `controls=0` funciona melhor com `autoplay=1`

### Alterações

**Arquivo: `src/pages/Index.tsx`**

Substituir o bloco do iframe atual por:
1. Estado `isPlaying` (useState)
2. Quando `!isPlaying`: mostrar thumbnail do YouTube (`https://img.youtube.com/vi/XsivhOx4Q0Q/maxresdefault.jpg`) com um botão de play centralizado (ícone SVG circular)
3. Quando `isPlaying`: renderizar o iframe com `autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0`
4. Manter o mesmo container responsivo (aspect-ratio 16:9, rounded-2xl, shadow-2xl)

### Resultado
O usuário vê uma imagem limpa com um botão de play elegante. Ao clicar, o vídeo reproduz sem controles visíveis.

