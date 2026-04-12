

## Diagnostico: Erro 504 na generate-copy

### Causa raiz
A edge function `generate-copy` recebeu um **504 Gateway Timeout** porque a API da OpenAI demorou mais de 150 segundos para responder. O modelo `gpt-5.4-mini` com function calling e prompts extensos pode ocasionalmente ultrapassar esse limite.

### Evidencia dos logs
- Chamada com falha: 150.082ms (timeout) -> status 504
- Chamada seguinte com sucesso: 11.079ms -> status 200
- Isso indica intermitencia -- as vezes a API responde rapido, as vezes nao.

### Solucoes propostas

**1. Migrar para Lovable AI Gateway (recomendado)**
Substituir a chamada direta a `api.openai.com` pelo Lovable AI Gateway, que suporta os mesmos modelos sem necessidade de API key externa. Usar `openai/gpt-5-mini` ou `google/gemini-2.5-flash` que sao mais rapidos para function calling.

**2. Adicionar timeout interno com retry**
Implementar um `AbortController` com timeout de 120s na chamada fetch, e em caso de timeout, tentar novamente uma vez com um modelo mais rapido como fallback.

**3. Simplificar o schema de function calling**
O schema atual e muito extenso (visual_options com 8 campos obrigatorios x 2 opcoes x 3 angulos + ad_captions). Isso aumenta o tempo de geracao. Podemos manter o mesmo resultado mas otimizar a chamada.

### Alteracoes tecnicas

**Arquivo: `supabase/functions/generate-copy/index.ts`**
- Substituir `https://api.openai.com/v1/chat/completions` por `https://ai.lovable.dev/chat/completions`
- Substituir header `Authorization: Bearer ${OPENAI_API_KEY}` por `Authorization: Bearer ${LOVABLE_API_KEY}`
- Alterar modelo de `gpt-5.4-mini` para `openai/gpt-5-mini` (compativel com Lovable AI Gateway)
- Adicionar `AbortController` com timeout de 90 segundos
- Adicionar logica de retry: se a primeira tentativa falhar por timeout, tentar novamente com `google/gemini-2.5-flash` como fallback

Nenhuma alteracao de banco de dados ou frontend necessaria.

