

## Plano: Migrar geração de imagens para Vertex AI com `gemini-3-pro-image-preview`

### Contexto
O arquivo enviado é uma **service account** do Google Cloud (projeto `genius-ads`). Para usar Vertex AI com service account, a edge function precisa:
1. Gerar um JWT assinado com a chave privada
2. Trocar o JWT por um access token OAuth2
3. Chamar a API Vertex AI com o access token

### Passo 1 — Armazenar credenciais como secret
- Salvar o conteúdo completo do JSON da service account como uma secret `GOOGLE_SERVICE_ACCOUNT_JSON` no projeto.

### Passo 2 — Reescrever `supabase/functions/generate-creative/index.ts`

**Autenticação via Service Account:**
- Parsear o JSON da secret para extrair `client_email` e `private_key`
- Gerar JWT com header `RS256`, claims `iss`, `sub`, `aud` (token endpoint), `scope` (`https://www.googleapis.com/auth/cloud-platform`), `iat`, `exp`
- Assinar o JWT usando `crypto.subtle.importKey` + `crypto.subtle.sign` (Web Crypto API nativa do Deno)
- Trocar o JWT por access token via `POST https://oauth2.googleapis.com/token`

**Chamada Vertex AI:**
- Endpoint: `https://us-central1-aiplatform.googleapis.com/v1/projects/genius-ads/locations/us-central1/publishers/google/models/gemini-3-pro-image-preview:generateContent`
- Header: `Authorization: Bearer ${accessToken}`
- Payload:
```json
{
  "contents": [{
    "parts": [
      { "text": "<prompt>" },
      { "inlineData": { "mimeType": "image/png", "data": "<base64>" } }
    ]
  }],
  "generationConfig": {
    "responseModalities": ["IMAGE"],
    "imageConfig": { "aspectRatio": "1:1" }
  }
}
```

**Imagens de referência:**
- Fetch cada URL assinada → arrayBuffer → base64 → enviar como `inlineData`

**Múltiplas imagens:**
- Gemini gera 1 imagem por chamada → `Promise.all` para `quantity` chamadas paralelas

**Resposta:**
- Extrair `inlineData.data` (base64) da resposta
- Upload como PNG no bucket `generated-creatives` via Supabase Storage (service role)
- Retornar `{ images: [{ url: "..." }] }` — mesmo contrato atual

**Manter `buildPrompt` intacta** — sem alterações na lógica do prompt.

### Sem alterações no frontend
O contrato de resposta é idêntico — `CreateCreative.tsx` e `RegenerateCreative.tsx` continuam funcionando sem mudanças.

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/generate-creative/index.ts` | Substituir Fal.ai por Vertex AI + service account auth |

