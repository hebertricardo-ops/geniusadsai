import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FORMAT_TO_RATIO: Record<string, string> = {
  "1:1": "1:1",
  "4:5": "4:5",
  "9:16": "9:16",
  "16:9": "16:9",
};

function buildPrompt(data: {
  product_name: string;
  format: string;
  promise: string;
  pains: string;
  benefits: string;
  objections?: string;
  headline: string;
  body: string;
  cta: string;
  color_palette?: string[];
  visual_option: {
    visual_description: string;
    element_distribution: string;
    composition: string;
    visual_hierarchy: string;
    layout_style: string;
    cta_highlight: string;
    thematic_elements?: string;
  };
}): string {
  const benefitsList = data.benefits
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  const painList = data.pains
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  const objectionsList = (data.objections || "")
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  return JSON.stringify(
    {
      tipo: "criativo_publicitario_estatico",
      formato: data.format,
      idioma_textos: "português do Brasil",
      objetivo: "anuncio_meta_ads",
      produto: {
        nome: data.product_name,
        promessa: data.promise,
      },
      conceito_criativo: {
        angulo: data.headline,
        dor_principal: painList,
        beneficios: benefitsList,
        objecoes_trabalhadas: objectionsList,
      },
      imagens_referencia: {
        instrucao: "usar as imagens fornecidas como base principal da composição, preservando identidade visual e contexto do produto/oferta",
      },
      layout: {
        estilo: data.visual_option.layout_style,
        composicao: data.visual_option.composition,
        hierarquia_visual: data.visual_option.visual_hierarchy,
        distribuicao_elementos: data.visual_option.element_distribution,
        destaque_cta: data.visual_option.cta_highlight,
      },
      textos: {
        headline: data.headline,
        subheadline: data.body,
        cta: data.cta,
      },
      direcao_visual: {
        descricao: data.visual_option.visual_description,
        atmosfera: "clean premium, conversão alta, estética realista de anúncio para Instagram/Facebook",
      },
      instrucoes_extras: [
        "manter design clean, premium e informativo",
        "garantir legibilidade em telas mobile",
        "priorizar contraste forte entre elementos principais e fundo",
        "usar as imagens de referência como elementos centrais da composição",
        "não adicionar texto renderizado na imagem; apenas compor o visual",
        "evitar poluição visual e manter acabamento profissional",
        data.visual_option.thematic_elements
          ? `incluir elementos visuais temáticos alinhados ao nicho: ${data.visual_option.thematic_elements}`
          : "incluir ícones ou elementos visuais que reforcem a identidade do nicho do produto",
      ],
    },
    null,
    2,
  );
}

async function safeJsonParse(response: Response, label: string): Promise<any> {
  const text = await response.text();
  console.log(`${label} status: ${response.status}, body (500 chars): ${text.substring(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON (status ${response.status}): ${text.substring(0, 200)}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) throw new Error("FAL_KEY not configured");

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const {
      image_urls,
      product_name,
      promise,
      pains,
      benefits,
      objections,
      headline,
      body,
      cta,
      visual_option,
      format,
      quantity,
    } = await req.json();

    if (!image_urls?.length) throw new Error("At least one image is required");
    if (!product_name || !headline || !cta || !visual_option) throw new Error("Missing required fields");

    const numImages = Math.min(Math.max(1, quantity || 1), 4);
    const aspectRatio = FORMAT_TO_RATIO[format] || "1:1";

    const prompt = buildPrompt({
      product_name,
      format,
      promise,
      pains,
      benefits,
      objections,
      headline,
      body,
      cta,
      visual_option,
    });

    console.log("Calling fal.ai with image_urls:", image_urls.length, "aspect_ratio:", aspectRatio, "num_images:", numImages);

    const falResponse = await fetch("https://queue.fal.run/fal-ai/nano-banana-pro/edit", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_urls: image_urls,
        prompt,
        aspect_ratio: aspectRatio,
        num_images: numImages,
          resolution: "1K",
        output_format: "png",
        safety_tolerance: "4",
      }),
    });

    const falData = await safeJsonParse(falResponse, "fal.ai submit");

    if (!falResponse.ok) {
      throw new Error(`fal.ai error: ${falResponse.status} - ${JSON.stringify(falData).substring(0, 300)}`);
    }

    // If queued (async mode), poll for result
    if (falData.request_id && !falData.images) {
      const requestId = falData.request_id;
      const statusUrl = falData.status_url;
      const responseUrl = falData.response_url;

      if (!statusUrl || !responseUrl) {
        throw new Error(`fal.ai queue response missing polling URLs: ${JSON.stringify(falData).substring(0, 300)}`);
      }

      console.log("fal.ai queued, polling request_id:", requestId);

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));

        const statusRes = await fetch(statusUrl, {
          headers: { Authorization: `Key ${FAL_KEY}` },
        });
        const statusData = await safeJsonParse(statusRes, "fal.ai status poll");

        if (statusData.status === "COMPLETED") {
          const resultRes = await fetch(responseUrl, {
            headers: { Authorization: `Key ${FAL_KEY}` },
          });
          const result = await safeJsonParse(resultRes, "fal.ai result");

          return new Response(JSON.stringify({ images: result.images || [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (statusData.status === "FAILED") {
          throw new Error("fal.ai generation failed: " + JSON.stringify(statusData).substring(0, 300));
        }
      }
      throw new Error("fal.ai generation timed out after 120s");
    }

    // Sync response
    return new Response(JSON.stringify({ images: falData.images || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-creative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
