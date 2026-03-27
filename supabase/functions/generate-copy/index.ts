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

    const systemPrompt = `Você é um copywriter especialista em anúncios que faturam múltiplos 6 dígitos. Gere copies curtas, diretas e voltadas para conversão em Meta Ads.`;

    const userPrompt = `Com base nas informações abaixo, gere 3 variações de copy com ângulos completamente diferentes.

Produto: ${product_name}
Promessa: ${promise}
Dores: ${pains}
Benefícios: ${benefits}
Objeções: ${objections || "Nenhuma informada"}
CTA: ${cta || "Compre agora"}

Para cada variação, retorne em JSON:
- angle_name: nome do ângulo
- headline: gancho forte
- subheadline: complemento
- body: corpo curto e persuasivo
- cta: chamada para ação`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_copies",
              description: "Return 3 ad copy variations with different angles",
              parameters: {
                type: "object",
                properties: {
                  copies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        angle_name: { type: "string" },
                        headline: { type: "string" },
                        subheadline: { type: "string" },
                        body: { type: "string" },
                        cta: { type: "string" },
                      },
                      required: ["angle_name", "headline", "subheadline", "body", "cta"],
                    },
                  },
                },
                required: ["copies"],
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

    const copies = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(copies), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-copy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
