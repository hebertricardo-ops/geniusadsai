import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const systemPrompt = `Você é um copywriter de elite, especialista em criativos estáticos de alta conversão para Meta Ads (Facebook e Instagram). Você gera copies em português do Brasil.

REGRAS OBRIGATÓRIAS:
- Headline com gancho forte e impactante
- Linguagem clara, persuasiva e direta — nada genérico
- Foco total em conversão
- CTA coerente com o que o usuário informou
- Textos curtos — pense em criativo estático de anúncio, não em artigo
- Subheadline é opcional — use apenas quando agregar valor
- Todas as copies em português do Brasil

DISTRIBUIÇÃO ESTRATÉGICA DOS 3 ÂNGULOS:
- Ângulo 1: Explorar a DOR PRINCIPAL do público
- Ângulo 2: Explorar o BENEFÍCIO / TRANSFORMAÇÃO
- Ângulo 3: Quebrar OBJEÇÃO / mostrar PRATICIDADE / RAPIDEZ / PROVA IMPLÍCITA

Cada ângulo deve ser genuinamente diferente dos outros em abordagem e tom.

OPÇÕES VISUAIS POR ÂNGULO:
Para cada ângulo, gere 2 VARIAÇÕES de conceito visual clean premium para o criativo estático:
- Variação A1: layout clean e premium — design sofisticado, minimalista e elegante, com composição equilibrada e uso refinado de espaço negativo
- Variação A2: layout clean e premium — igualmente sofisticado, porém com mais elementos gráficos, texturas e destaques visuais que enriquecem a composição mantendo a elegância

Ambas as variações devem manter o padrão premium e sofisticado. A diferença está na abordagem visual (mais minimalista vs mais rica em elementos), NÃO no tom da copy.

REGRA IMPORTANTE PARA AMBAS AS VARIAÇÕES:
- Identifique o produto, nicho e suas características
- Inclua elementos visuais temáticos (ícones, figurinhas, badges, selos) que estejam alinhados com o produto e nicho do anúncio
- Esses elementos devem reforçar a identidade do nicho e tornar o criativo mais contextualizado e profissional
- Exemplos: nicho fitness → ícones de halteres, chamas, troféus; nicho beleza → elementos florais, brilhos; nicho educação → livros, lâmpadas, estrelas

Cada opção visual deve conter orientações de:
- Descrição curta da linha visual
- Distribuição sugerida dos elementos no criativo
- Orientação de composição
- Proposta de hierarquia visual
- Estilo do layout
- Como destacar o CTA visualmente
- Elementos temáticos sugeridos (ícones/figurinhas alinhados ao nicho)`;

const tools = [
  {
    type: "function",
    function: {
      name: "generate_copies",
      description: "Return 3 ad copy angles, each with 2 visual concept options",
      parameters: {
        type: "object",
        properties: {
          angles: {
            type: "array",
            description: "3 different copy angles",
            items: {
              type: "object",
              properties: {
                angle_name: { type: "string", description: "Nome do ângulo (ex: Dor Principal, Transformação, Quebra de Objeção)" },
                headline: { type: "string", description: "Gancho forte e impactante" },
                subheadline: { type: "string", description: "Complemento opcional da headline" },
                body: { type: "string", description: "Corpo curto e persuasivo" },
                cta: { type: "string", description: "Chamada para ação" },
                visual_options: {
                  type: "array",
                  description: "2 opções de conceito visual para este ângulo",
                  items: {
                    type: "object",
                    properties: {
                      option_label: { type: "string", description: "Ex: Variação A1 - Minimalista Premium ou Variação A2 - Premium Rico em Elementos" },
                      visual_description: { type: "string", description: "Mini descrição da linha visual" },
                      element_distribution: { type: "string", description: "Distribuição sugerida dos elementos no criativo" },
                      composition: { type: "string", description: "Orientação de composição" },
                      visual_hierarchy: { type: "string", description: "Proposta de hierarquia visual" },
                      layout_style: { type: "string", description: "Estilo do layout" },
                      cta_highlight: { type: "string", description: "Como destacar o CTA visualmente" },
                      thematic_elements: { type: "string", description: "Ícones, figurinhas, badges ou selos temáticos alinhados ao produto e nicho" },
                    },
                    required: ["option_label", "visual_description", "element_distribution", "composition", "visual_hierarchy", "layout_style", "cta_highlight", "thematic_elements"],
                  },
                },
              },
              required: ["angle_name", "headline", "body", "cta", "visual_options"],
            },
          },
          ad_captions: {
            type: "array",
            description: "3 opções de legenda para o anúncio/postagem, cada uma com gancho, desenvolvimento e CTA",
            items: {
              type: "object",
              properties: {
                caption: { type: "string", description: "Legenda completa pronta para uso" },
              },
              required: ["caption"],
            },
          },
        },
        required: ["angles", "ad_captions"],
      },
    },
  },
];

async function callAI(model: string, userPrompt: string, timeoutMs: number) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "generate_copies" } },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const t = await response.text();
      console.error(`AI error (${model}):`, response.status, t);
      if (response.status === 429) {
        return { error: "Rate limit exceeded. Try again shortly.", status: 429 };
      }
      if (response.status === 402) {
        return { error: "Credits exhausted.", status: 402 };
      }
      throw new Error(`AI gateway error (${response.status})`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    return { result: JSON.parse(toolCall.function.arguments) };
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      console.warn(`Timeout after ${timeoutMs}ms with model ${model}`);
      throw new Error("TIMEOUT");
    }
    throw e;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product_name, promise, pains, benefits, objections, cta } = await req.json();

    const userPrompt = `Gere 3 ângulos de copy com 2 opções visuais cada para o seguinte produto:

Produto: ${product_name}
Promessa: ${promise}
Dores: ${pains}
Benefícios: ${benefits}
Objeções: ${objections || "Nenhuma informada"}
CTA base informado pelo usuário: ${cta || "Compre agora"}

REGRA DE CTA: Use o CTA informado pelo usuário como ponto de partida e reescreva-o incluindo uma frase que desperte gatilho de urgência ou curiosidade. Ex: se o CTA base for "Saiba Mais", o CTA final pode ser "Saiba Mais Antes que Acabe" ou "Descubra o Segredo — Saiba Mais".

REGRA DE LEGENDAS: Além dos ângulos, gere também 3 opções de legenda para o anúncio/postagem. Cada legenda deve seguir a estrutura: 1) Gancho forte (primeira linha que prende atenção), 2) Desenvolvimento persuasivo (2-3 frases curtas), 3) CTA final. As legendas devem ser variadas em tom e abordagem, baseadas nas informações do produto. Máximo de 280 caracteres por legenda.`;

    // Try primary model with 90s timeout
    let response;
    try {
      console.log("Attempting with openai/gpt-5-mini...");
      response = await callAI("openai/gpt-5-mini", userPrompt, 90000);
    } catch (e) {
      if (e.message === "TIMEOUT") {
        // Fallback to faster model
        console.log("Primary model timed out, retrying with google/gemini-2.5-flash...");
        response = await callAI("google/gemini-2.5-flash", userPrompt, 120000);
      } else {
        throw e;
      }
    }

    // Handle rate limit / credits errors
    if (response.error) {
      return new Response(JSON.stringify({ error: response.error }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(response.result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-copy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
