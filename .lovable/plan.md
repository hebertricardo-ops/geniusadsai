

## Alterar fonte dos títulos para Changa One

Substituir a fonte de display "Space Grotesk" por "Changa One" do Google Fonts em todos os títulos da aplicação.

### Alterações

**1. `src/index.css`** — Atualizar import do Google Fonts
- Trocar `Space+Grotesk:wght@400;500;600;700` por `Changa+One:wght@400`
- Atualizar `--font-display` de `'Space Grotesk'` para `'Changa One'`

**2. `tailwind.config.ts`** — Atualizar fontFamily
- Trocar `["Space Grotesk", "sans-serif"]` por `["Changa One", "sans-serif"]` no `fontFamily.display`

Isso propaga automaticamente para todos os `h1`-`h6` (via regra CSS base) e qualquer uso de `font-display` no projeto.

