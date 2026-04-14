import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  additional_instructions?: string;
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
        instrucao:
          "usar as imagens fornecidas como base principal da composição, preservando identidade visual e contexto do produto/oferta",
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
        atmosfera:
          "clean premium, conversão alta, estética realista de anúncio para Instagram/Facebook",
      },
      instrucoes_extras: [
        "manter design clean, premium e informativo",
        "garantir legibilidade em telas mobile",
        "priorizar contraste forte entre elementos principais e fundo",
        "usar as imagens de referência como elementos centrais da composição",
        "não adicionar texto renderizado na imagem; apenas compor o visual",
        "evitar poluição visual e manter acabamento profissional",
        "criar background elaborado com elementos visuais que façam referência ao produto e nicho, evitar fundos de cor única — usar texturas, gradientes, padrões ou elementos contextuais",
        "incluir efeitos tecnológicos como linhas geométricas finas, gradientes sutis, elementos em transparência, overlays e formas abstratas que deem um visual moderno e tecnológico ao criativo",
        ...(data.color_palette && data.color_palette.length > 0
          ? [
              `utilizar a seguinte paleta de cores como base do design: ${data.color_palette.join(", ")}`,
            ]
          : []),
        data.visual_option.thematic_elements
          ? `incluir elementos visuais temáticos alinhados ao nicho: ${data.visual_option.thematic_elements}`
          : "incluir ícones ou elementos visuais que reforcem a identidade do nicho do produto",
        ...(data.additional_instructions
          ? [
              `orientações adicionais do usuário: ${data.additional_instructions}`,
            ]
          : []),
      ],
    },
    null,
    2,
  );
}

async function generateWithRetry(
  falKey: string,
  prompt: string,
  imageUrls: string[],
  aspectRatio: string,
  index: number,
  maxRetries = 3,
): Promise<{ url: string }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch("https://fal.run/fal-ai/nano-banana-pro/edit", {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_urls: imageUrls,
        aspect_ratio: aspectRatio,
      }),
    });

    if (res.status === 429) {
      if (attempt === maxRetries) {
        throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
      }
      const wait = Math.pow(2, attempt + 1) * 1000;
      console.log(`Rate limited (429) on image ${index}, waiting ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`fal.ai error (${res.status}): ${errText.substring(0, 500)}`);
    }

    const result = await res.json();
    const generatedUrl = result?.images?.[0]?.url;
    if (!generatedUrl) {
      throw new Error(`No image in fal.ai response for index ${index}: ${JSON.stringify(result).substring(0, 500)}`);
    }

    return { url: generatedUrl };
  }
  throw new Error("Max retries exceeded");
}

async function updateRequestStatus(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  productName: string,
  status: string,
) {
  try {
    const { data } = await supabaseAdmin
      .from("creative_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("product_name", productName)
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data?.id) {
      await supabaseAdmin
        .from("creative_requests")
        .update({ status })
        .eq("id", data.id);
      console.log(`Updated request ${data.id} status to '${status}'`);
    }
  } catch (e) {
    console.error("Failed to update request status:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const falKey = Deno.env.get("FAL_KEY");
    if (!falKey) throw new Error("FAL_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
      color_palette,
      additional_instructions,
    } = await req.json();

    if (!image_urls?.length) throw new Error("At least one image is required");
    if (!product_name || !headline || !cta || !visual_option)
      throw new Error("Missing required fields");

    // Extract user_id from JWT for status updates
    let userId: string | null = null;
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id || null;
    } catch { /* ignore */ }

    const numImages = Math.min(Math.max(1, quantity || 1), 4);
    const aspectRatio = FORMAT_TO_RATIO[format] || "1:1";

    const promptJson = buildPrompt({
      product_name,
      format,
      promise,
      pains,
      benefits,
      objections,
      headline,
      body,
      cta,
      color_palette,
      additional_instructions,
      visual_option,
    });

    const prompt = promptJson;

    console.log("Generating", numImages, "images via fal.ai nano-banana-pro...");
    const generatedImages: { url: string }[] = [];
    for (let i = 0; i < numImages; i++) {
      console.log(`Generating image ${i + 1}/${numImages}...`);
      const img = await generateWithRetry(falKey, prompt, image_urls, aspectRatio, i);
      generatedImages.push(img);
    }

    console.log("Uploading", generatedImages.length, "images to storage...");

    const uploadedUrls = await Promise.all(
      generatedImages.map(async (img) => {
        const imgRes = await fetch(img.url);
        if (!imgRes.ok) throw new Error(`Failed to download generated image: ${imgRes.status}`);
        const arrayBuf = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);

        const contentType = imgRes.headers.get("content-type") || "image/png";
        const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
        const fileName = `${crypto.randomUUID()}.${ext}`;

        const { error } = await supabaseAdmin.storage
          .from("generated-creatives")
          .upload(fileName, bytes, {
            contentType,
            upsert: false,
          });

        if (error) throw new Error(`Storage upload failed: ${error.message}`);

        const { data: urlData } = supabaseAdmin.storage
          .from("generated-creatives")
          .getPublicUrl(fileName);

        return { url: urlData.publicUrl };
      })
    );

    console.log("Successfully generated and uploaded", uploadedUrls.length, "images");

    return new Response(JSON.stringify({ images: uploadedUrls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-creative error:", e);

    // Try to update request status to 'error'
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Find the most recent processing request and mark it as error
      const { data: processingRequests } = await supabaseAdmin
        .from("creative_requests")
        .select("id")
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(5);

      if (processingRequests?.length) {
        for (const req of processingRequests) {
          await supabaseAdmin
            .from("creative_requests")
            .update({ status: "error" })
            .eq("id", req.id);
        }
        console.log(`Marked ${processingRequests.length} processing requests as error`);
      }
    } catch (statusErr) {
      console.error("Failed to update request status to error:", statusErr);
    }

    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
