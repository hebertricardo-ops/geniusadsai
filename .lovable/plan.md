

## Plano de implementação

### Resumo
Quatro alterações no fluxo de criação de criativos: (1) substituir Opção A + Opção B por duas variações da Opção A (clean premium); (2) adicionar instruções de background contextual e efeitos tecnológicos ao prompt de geração de imagem; (3) adicionar campo de "Orientações adicionais" no passo 4; (4) passar essas orientações ao backend.

---

### Alterações

**1. generate-copy (Edge Function) — Remover Opção B, gerar 2 variações de Opção A**
- No `systemPrompt`, substituir a descrição das duas opções (A clean + B agressivo) por: gerar 2 variações de conceito visual clean premium, ambas com design sofisticado mas com abordagens visuais diferentes (ex: uma mais minimalista, outra com mais elementos gráficos/destaque).
- Atualizar os labels no schema de `option_label` para refletir "Variação A1" e "Variação A2".

**2. generate-creative (Edge Function) — Background contextual + efeitos tecnológicos**
- Em `buildPrompt`, adicionar novas `instrucoes_extras`:
  - "criar background elaborado com elementos visuais que façam referência ao produto e nicho, evitar fundos de cor única"
  - "incluir efeitos tecnológicos como linhas geométricas, gradientes sutis, elementos em transparência e overlays que deem um visual moderno e tecnológico"
- Adicionar campo `additional_instructions` ao tipo de dados aceito e incluí-lo nas `instrucoes_extras` quando presente.

**3. CreateCreative.tsx — Campo "Orientações adicionais" no passo 4**
- Novo state `additionalInstructions`.
- No `step === 3`, adicionar um `Textarea` abaixo do campo de CTA com label "Orientações adicionais (opcional)" e placeholder explicativo.
- Passar `additional_instructions` nas chamadas a `generate-creative`.

**4. RegenerateCreative.tsx — Mesma lógica**
- Adicionar o campo `additionalInstructions` e passá-lo na chamada ao edge function.

---

### Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/generate-copy/index.ts` | Reescrever seção "OPÇÕES VISUAIS" no systemPrompt para 2 variações clean premium |
| `supabase/functions/generate-creative/index.ts` | Adicionar `additional_instructions` ao input + novas instruções de background/efeitos no `buildPrompt` |
| `src/pages/CreateCreative.tsx` | Novo state + campo Textarea no step 3 + passar nas chamadas |
| `src/pages/RegenerateCreative.tsx` | Mesmo campo + passar nas chamadas |

