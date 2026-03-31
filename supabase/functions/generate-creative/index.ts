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

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(saJson: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  );

  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: saJson.client_email,
        sub: saJson.client_email,
        aud: saJson.token_uri,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        iat: now,
        exp: now + 3600,
      })
    )
  );

  // Import RSA private key
  const pemBody = saJson.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(`${header}.${payload}`)
  );

  const jwt = `${header}.${payload}.${base64url(signature)}`;

  // Exchange JWT for access token
  const tokenRes = await fetch(saJson.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token exchange failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function imageUrlToBase64(url: string): Promise<{ mimeType: string; data: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);

  const contentType = res.headers.get("content-type") || "image/png";
  return { mimeType: contentType.split(";")[0], data: base64 };
}

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

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const saJsonRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJsonRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const saJson = JSON.parse(saJsonRaw);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      color_palette,
      additional_instructions,
      visual_option,
    });

    // Get Google access token
    console.log("Authenticating with Google service account...");
    const accessToken = await getAccessToken(saJson);
    console.log("Access token obtained successfully");

    // Convert reference images to base64
    console.log("Converting", image_urls.length, "reference images to base64...");
    const imagesParts = await Promise.all(
      image_urls.map(async (url: string) => {
        const img = await imageUrlToBase64(url);
        return { inlineData: { mimeType: img.mimeType, data: img.data } };
      })
    );

    // Build Vertex AI request
    const vertexEndpoint = `https://aiplatform.googleapis.com/v1/projects/${saJson.project_id}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;

    const vertexPayload = {
      contents: [
        {
          parts: [{ text: prompt }, ...imagesParts],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio,
        },
      },
    };

    // Generate images in parallel (Gemini generates 1 per call)
    console.log("Generating", numImages, "images via Vertex AI...");
    const generateOne = async (index: number) => {
      const res = await fetch(vertexEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vertexPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `Vertex AI error (${res.status}): ${errText.substring(0, 500)}`
        );
      }

      const result = await res.json();

      // Extract base64 image from response
      const candidates = result.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            return {
              base64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || "image/png",
            };
          }
        }
      }
      throw new Error(
        `No image in Vertex AI response for index ${index}: ${JSON.stringify(result).substring(0, 500)}`
      );
    };

    const generatedImages = await Promise.all(
      Array.from({ length: numImages }, (_, i) => generateOne(i))
    );

    // Upload to Supabase Storage
    console.log("Uploading", generatedImages.length, "images to storage...");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const uploadedUrls = await Promise.all(
      generatedImages.map(async (img, i) => {
        const ext = img.mimeType.includes("jpeg") || img.mimeType.includes("jpg") ? "jpg" : "png";
        const fileName = `${crypto.randomUUID()}.${ext}`;

        // Decode base64 to Uint8Array
        const binaryStr = atob(img.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j);
        }

        const { error } = await supabaseAdmin.storage
          .from("generated-creatives")
          .upload(fileName, bytes, {
            contentType: img.mimeType,
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
