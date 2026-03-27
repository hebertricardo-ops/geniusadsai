

# Plano: Integrar OpenAI API para geração de copies

## Resumo

Vou configurar sua chave da OpenAI como um secret seguro no backend e atualizar a edge function `generate-copy` para chamar diretamente a API da OpenAI (`https://api.openai.com/v1/chat/completions`) usando o modelo `gpt-4o` (ou outro de sua preferência), em vez do Lovable AI Gateway.

## Etapas

### 1. Solicitar a chave OPENAI_API_KEY
- Usar a ferramenta de secrets para pedir que você insira sua chave de API da OpenAI
- A chave fica armazenada de forma segura no backend, nunca exposta no frontend

### 2. Atualizar a Edge Function `generate-copy`
Alterações no arquivo `supabase/functions/generate-copy/index.ts`:

- **Trocar a variável de ambiente** de `LOVABLE_API_KEY` para `OPENAI_API_KEY`
- **Trocar o endpoint** de `https://ai.gateway.lovable.dev/v1/chat/completions` para `https://api.openai.com/v1/chat/completions`
- **Trocar o modelo** de `google/gemini-3-flash-preview` para `gpt-4o` (melhor custo-benefício atual da OpenAI)
- Manter toda a lógica de tool calling (structured output) e tratamento de erros intacta — a API da OpenAI usa o mesmo formato

### Detalhes técnicos

A edge function continuará usando o mesmo formato de request (compatível OpenAI), então a única mudança real é:
- URL do endpoint
- Chave de autenticação
- Nome do modelo

O restante (prompts, tool calling, parsing de resposta, CORS) permanece idêntico. Nenhuma alteração no frontend é necessária.

