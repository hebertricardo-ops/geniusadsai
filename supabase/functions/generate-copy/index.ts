import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const { product_name, promise, pains, benefits, objections, cta } = await req.json();

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

    const userPrompt = `Gere 3 ângulos de copy com 2 opções visuais cada para o seguinte produto:

Produto: ${product_name}
Promessa: ${promise}
Dores: ${pains}
Benefícios: ${benefits}
Objeções: ${objections || "Nenhuma informada"}
CTA desejado: ${cta || "Compre agora"}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
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
                },
                required: ["angles"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_copies" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-copy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
