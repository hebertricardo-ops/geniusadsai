import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
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

// ─── SYSTEM PROMPT FOR COPY GENERATION ───
const CAROUSEL_SYSTEM_PROMPT = `Você é um copywriter especialista em marketing direto, Meta Ads, social media e criação de carrosséis estáticos de alta conversão para produtos físicos, digitais e serviços.

Sua tarefa é gerar a copy completa de um carrossel publicitário ou de conteúdo estratégico com base nas informações fornecidas pelo usuário.

O carrossel deve ter entre 4 e 8 slides.
O último slide deve ser sempre um slide de fechamento com CTA obrigatório.
Cada slide deve cumprir uma função estratégica dentro de uma progressão lógica de persuasão.

Seu objetivo é criar um carrossel com estrutura forte, clareza, impacto visual, progressão narrativa e potencial de conversão.

REGRAS GERAIS:
1. Escreva sempre em português do Brasil.
2. Nunca gere textos genéricos, vagos ou superficiais.
3. Evite excesso de texto por slide. O conteúdo precisa caber visualmente em um carrossel.
4. Cada slide deve ter copy curta, clara, forte e visualmente escaneável.
5. O texto deve soar natural, persuasivo e moderno.
6. Não use parágrafos longos.
7. Não repita a mesma ideia em slides diferentes.
8. O último slide deve conter CTA claro e direto.
9. A estrutura deve ser adaptada conforme a quantidade de slides.
10. A copy deve refletir o objetivo do carrossel informado pelo usuário.
11. Sempre considerar dores, benefícios, objeções, promessa e contexto do produto para construir a narrativa.
12. Quando fizer sentido, usar linguagem de contraste, curiosidade, especificidade, identificação, desejo e urgência.
13. O texto deve ser pensado para performance em redes sociais e anúncios.
14. Gere também uma orientação estratégica curta sobre a função de cada slide.
15. Sempre mantenha coerência entre os slides, como se fosse uma sequência única e intencional.
16. Priorize headlines curtas e fortes, com no máximo 12 palavras sempre que possível.
17. Priorize subtextos curtos, com no máximo 18 palavras sempre que possível.
18. Nunca escreva como se todos os slides fossem iguais em intensidade. Varie o ritmo da narrativa.
19. Sempre faça o último slide funcionar como fechamento persuasivo e estímulo de ação.

ESTRUTURA ESTRATÉGICA:
Você deve distribuir os slides dentro desta lógica, adaptando conforme a quantidade escolhida:
- Slide 1: Gancho forte
- Slide 2: Dor, problema ou identificação
- Slide 3: Agravamento, consequência ou aprofundamento
- Slide 4: Virada, insight ou nova perspectiva
- Slide 5: Solução ou apresentação da oferta
- Slide 6: Benefícios principais
- Slide 7: Quebra de objeção, reforço ou prova lógica
- Slide final: CTA

ADAPTAÇÃO POR QUANTIDADE DE SLIDES:
- Se forem 4 slides: 1.Gancho 2.Dor 3.Solução 4.CTA
- Se forem 5 slides: 1.Gancho 2.Dor 3.Insight 4.Solução 5.CTA
- Se forem 6 slides: 1.Gancho 2.Dor 3.Agravamento 4.Solução 5.Benefícios 6.CTA
- Se forem 7 slides: 1.Gancho 2.Dor 3.Agravamento 4.Insight 5.Solução 6.Benefícios 7.CTA
- Se forem 8 slides: 1.Gancho 2.Dor 3.Agravamento 4.Insight 5.Solução 6.Benefícios 7.Quebra de objeção 8.CTA

OBJETIVO DO CARROSSEL:
Adapte o tom e a estrutura conforme o objetivo informado:
- vender diretamente
- gerar curiosidade
- educar / entregar valor
- quebrar objeções
- engajar (salvar, compartilhar, comentar)

DIRETRIZES DE COPY:
- O slide 1 deve prender atenção imediatamente.
- O slide final deve estimular ação.
- Use headlines que funcionem bem visualmente.
- Quando necessário, inclua subtexto curto.
- Não torne todos os slides exageradamente chamativos. Varie o ritmo da narrativa.
- Misture impacto, clareza e fluidez.
- Benefícios devem ser concretos.
- Objeções devem ser respondidas com lógica simples e convincente.
- O CTA final deve ser compatível com o contexto da oferta.
- O texto precisa caber bem em layout de slide.
- Evite frases longas demais.
- Sempre pense em performance para Meta Ads e redes sociais.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const body = await req.json();
    const { phase } = body;

    if (phase === "copy") {
      return await handleCopyPhase(body);
    } else if (phase === "images") {
      return await handleImagesPhase(body);
    } else if (phase === "single-image") {
      return await handleSingleImagePhase(body);
    } else {
      throw new Error("Invalid phase. Must be 'copy', 'images', or 'single-image'.");
    }
  } catch (e) {
    console.error("generate-carousel error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ═══════════════════════════════════════════════════════
// PHASE 1: Generate copy only (fast, ~5s)
// ═══════════════════════════════════════════════════════
async function handleCopyPhase(body: any) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const { product_name, main_promise, pain_points, benefits, objections, carousel_objective, creative_style, extra_context, slides_count, cta } = body;

  if (!product_name || !main_promise || !pain_points || !benefits || !carousel_objective)
    throw new Error("Missing required fields");

  const numSlides = Math.min(Math.max(4, slides_count || 4), 8);

  console.log("Phase 1 (copy): Generating carousel copy via OpenAI...");

  const userPrompt = `Quantidade de slides: ${numSlides}
Nome do produto: ${product_name}
Promessa principal: ${main_promise}
Principais dores: ${pain_points}
Principais benefícios: ${benefits}
Principais objeções: ${objections || "Nenhuma informada"}
Objetivo do carrossel: ${carousel_objective}
Tom/estilo desejado: ${creative_style || "Não especificado"}
CTA desejado para o slide final: ${cta || "A IA deve criar um CTA adequado"}
Informações adicionais: ${extra_context || "Nenhuma"}

Agora gere a copy completa do carrossel.`;

  const slideSchema = {
    type: "object" as const,
    properties: {
      slide_number: { type: "number" as const },
      slide_role: { type: "string" as const },
      strategy: { type: "string" as const },
      headline: { type: "string" as const },
      subtext: { type: "string" as const },
      cta: { type: "string" as const },
    },
    required: ["slide_number", "slide_role", "strategy", "headline", "subtext", "cta"] as const,
  };

  const copyResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: CAROUSEL_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_carousel",
            description: "Return the complete carousel copy as structured JSON",
            parameters: {
              type: "object",
              properties: {
                carousel_title: { type: "string", description: "Título estratégico interno do carrossel" },
                slides_count: { type: "number", description: "Quantidade de slides" },
                credits_cost: { type: "number", description: "Custo em créditos (igual a slides_count)" },
                objective: { type: "string", description: "Objetivo do carrossel" },
                slides: {
                  type: "array",
                  description: "Array de slides do carrossel",
                  items: slideSchema,
                },
              },
              required: ["carousel_title", "slides_count", "credits_cost", "objective", "slides"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_carousel" } },
    }),
  });

  if (!copyResponse.ok) {
    const t = await copyResponse.text();
    console.error("OpenAI error:", copyResponse.status, t);
    if (copyResponse.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error(`OpenAI error (${copyResponse.status})`);
  }

  const copyData = await copyResponse.json();
  const toolCall = copyData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in OpenAI response");

  const carouselCopy = JSON.parse(toolCall.function.arguments);
  console.log("Copy generated:", carouselCopy.carousel_title, "-", carouselCopy.slides.length, "slides");

  return new Response(
    JSON.stringify({ copy: carouselCopy }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ═══════════════════════════════════════════════════════
// PHASE 2: Generate images from approved copy (slow)
// ═══════════════════════════════════════════════════════
async function handleImagesPhase(body: any) {
  const saJsonRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJsonRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  const saJson = JSON.parse(saJsonRaw);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const { image_urls, copy, product_name, creative_style, slides_count } = body;
  if (!copy?.slides?.length) throw new Error("Missing approved copy data");

  const numSlides = copy.slides.length;
  console.log("Phase 2 (images): Generating", numSlides, "slide images via Vertex AI...");

  const accessToken = await getAccessToken(saJson);

  let imagesParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  if (image_urls?.length) {
    console.log("Converting", image_urls.length, "reference images to base64...");
    imagesParts = await Promise.all(
      image_urls.map(async (url: string) => {
        const img = await imageUrlToBase64(url);
        return { inlineData: { mimeType: img.mimeType, data: img.data } };
      })
    );
  }

  const vertexEndpoint = `https://aiplatform.googleapis.com/v1/projects/${saJson.project_id}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const generateSlideImage = async (slide: any, index: number) => {
    const slidePrompt = JSON.stringify({
      tipo: "slide_de_carrossel_publicitario",
      formato: "1:1",
      idioma: "português do Brasil",
      produto: product_name,
      estilo: creative_style || "clean premium tecnológico",
      conteudo_do_slide: {
        numero: slide.slide_number,
        funcao: slide.slide_role,
        texto_headline: slide.headline,
        texto_subtexto: slide.subtext,
        texto_cta: slide.cta || null,
      },
      instrucoes_de_composicao: [
        "OBRIGATÓRIO: renderizar os textos fornecidos (headline, subtexto, cta) diretamente na imagem do slide, em português do Brasil, com tipografia legível e bem posicionada",
        "o headline deve ter destaque visual (maior, bold, contraste alto)",
        "o subtexto deve aparecer menor, abaixo do headline",
        "se houver CTA, renderizar como botão ou destaque visual no slide",
        "todos os textos devem estar em PORTUGUÊS DO BRASIL exatamente como fornecidos — não traduzir, não alterar",
        "criar um slide visualmente impactante para carrossel de anúncio",
        "usar as imagens de referência como base visual quando fornecidas",
        "manter design clean, premium e profissional",
        "garantir que o slide funcione bem em sequência com os demais",
        "criar background elaborado com elementos visuais contextuais",
      "incluir efeitos tecnológicos: linhas geométricas, gradientes sutis, overlays",
        `este é o slide ${slide.slide_number} de ${numSlides} — função: ${slide.slide_role}`,
        "PROIBIDO: NÃO incluir numeração de slide na imagem (ex: 1/6, 2/8, slide 3 de 5, etc). A imagem não deve conter nenhum indicador numérico de posição ou sequência.",
        slide.slide_role === "gancho" ? "visual chamativo e impactante para prender atenção" : "",
        slide.slide_role === "cta" ? "visual de fechamento com destaque para call-to-action" : "",
      ].filter(Boolean),
    }, null, 2);

    const vertexPayload = {
      contents: [{ role: "user", parts: [{ text: slidePrompt }, ...imagesParts] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
    };

    const res = await fetch(vertexEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(vertexPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Vertex AI error for slide ${index + 1} (${res.status}): ${errText.substring(0, 500)}`);
    }

    const result = await res.json();
    const candidates = result.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
        }
      }
    }
    throw new Error(`No image in Vertex AI response for slide ${index + 1}`);
  };

  // Generate slide images sequentially to avoid rate limits
  const generatedImages: Array<{ base64: string; mimeType: string; index: number } | null> = [];
  for (let i = 0; i < copy.slides.length; i++) {
    const slide = copy.slides[i];
    let lastError: string | null = null;
    let success = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(10000 * Math.pow(2, attempt - 1), 60000);
          console.log(`Retry ${attempt} for slide ${i + 1}, waiting ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
        const startTime = Date.now();
        const img = await generateSlideImage(slide, i);
        generatedImages.push({ ...img, index: i });
        success = true;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Slide ${i + 1}/${copy.slides.length} generated successfully in ${elapsed}s`);
        if (i < copy.slides.length - 1) {
          console.log(`Waiting 8s before next slide...`);
          await new Promise(r => setTimeout(r, 8000));
        }
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error(`Slide ${i + 1} attempt ${attempt + 1} failed:`, lastError);
        if (!lastError.includes("429") && !lastError.includes("RESOURCE_EXHAUSTED")) break;
      }
    }

    if (!success) {
      console.error(`Slide ${i + 1} failed permanently: ${lastError}`);
      generatedImages.push(null);
    }
  }

  const successfulImages = generatedImages.filter((img): img is NonNullable<typeof img> => img !== null);

  if (successfulImages.length === 0) {
    return new Response(
      JSON.stringify({ error: "Todas as imagens falharam. Tente novamente em alguns minutos.", fallback: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Upload to storage
  console.log("Uploading", successfulImages.length, "slide images to storage...");
  const slideResults = await Promise.all(
    successfulImages.map(async (img) => {
      const ext = img.mimeType.includes("jpeg") || img.mimeType.includes("jpg") ? "jpg" : "png";
      const fileName = `carousel-${crypto.randomUUID()}.${ext}`;
      const binaryStr = atob(img.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);

      const { error } = await supabaseAdmin.storage
        .from("generated-creatives")
        .upload(fileName, bytes, { contentType: img.mimeType, upsert: false });
      if (error) throw new Error(`Storage upload failed for slide ${img.index + 1}: ${error.message}`);

      const { data: urlData } = supabaseAdmin.storage.from("generated-creatives").getPublicUrl(fileName);
      return { slide_number: copy.slides[img.index].slide_number, image_url: urlData.publicUrl };
    })
  );

  const failedCount = copy.slides.length - successfulImages.length;
  console.log(`Generated ${slideResults.length}/${copy.slides.length} slide images (${failedCount} failed)`);

  return new Response(
    JSON.stringify({ 
      slides: slideResults,
      partial: failedCount > 0,
      failed_count: failedCount,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ═══════════════════════════════════════════════════════
// PHASE 3: Generate a SINGLE slide image (no batch)
// ═══════════════════════════════════════════════════════
async function handleSingleImagePhase(body: any) {
  const saJsonRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJsonRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  const saJson = JSON.parse(saJsonRaw);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const { slide, image_urls, product_name, creative_style, total_slides, carousel_style_reference } = body;
  if (!slide || !slide.headline) throw new Error("Missing slide data");

  console.log(`Single-image: Generating slide ${slide.slide_number}/${total_slides || "?"} - ${slide.slide_role}`);

  const accessToken = await getAccessToken(saJson);

  let imagesParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  if (image_urls?.length) {
    console.log("Converting", image_urls.length, "reference images to base64...");
    imagesParts = await Promise.all(
      image_urls.map(async (url: string) => {
        const img = await imageUrlToBase64(url);
        return { inlineData: { mimeType: img.mimeType, data: img.data } };
      })
    );
  }

  const vertexEndpoint = `https://aiplatform.googleapis.com/v1/projects/${saJson.project_id}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const styleRef = carousel_style_reference || creative_style || "clean premium tecnológico";

  const slidePrompt = JSON.stringify({
    tipo: "slide_de_carrossel_publicitario",
    formato: "1:1",
    idioma: "português do Brasil",
    produto: product_name,
    estilo_global_do_carrossel: {
      estilo: styleRef,
      instrucao: "Este slide faz parte de um carrossel. Mantenha a mesma paleta de cores, estilo de fundo, tipografia visual e elementos decorativos consistentes com os demais slides do carrossel.",
      total_slides: total_slides || 1,
    },
    conteudo_do_slide: {
      numero: slide.slide_number,
      funcao: slide.slide_role,
      texto_headline: slide.headline,
      texto_subtexto: slide.subtext,
      texto_cta: slide.cta || null,
    },
    instrucoes_de_composicao: [
      "OBRIGATÓRIO: renderizar os textos fornecidos (headline, subtexto, cta) diretamente na imagem do slide, em português do Brasil, com tipografia legível e bem posicionada",
      "o headline deve ter destaque visual (maior, bold, contraste alto)",
      "o subtexto deve aparecer menor, abaixo do headline",
      "se houver CTA, renderizar como botão ou destaque visual no slide",
      "todos os textos devem estar em PORTUGUÊS DO BRASIL exatamente como fornecidos — não traduzir, não alterar",
      "criar um slide visualmente impactante para carrossel de anúncio",
      "usar as imagens de referência como base visual quando fornecidas",
      "manter design clean, premium e profissional",
      "garantir que o slide funcione bem em sequência com os demais",
      "criar background elaborado com elementos visuais contextuais",
      "incluir efeitos tecnológicos: linhas geométricas, gradientes sutis, overlays",
      `este é o slide ${slide.slide_number} de ${total_slides || "?"} — função: ${slide.slide_role}`,
      "PROIBIDO: NÃO incluir numeração de slide na imagem (ex: 1/6, 2/8, slide 3 de 5, etc). A imagem não deve conter nenhum indicador numérico de posição ou sequência.",
      "IMPORTANTE: manter consistência visual com os outros slides do carrossel (mesma paleta, mesmo estilo de fundo, mesmos elementos decorativos)",
      slide.slide_role === "gancho" ? "visual chamativo e impactante para prender atenção" : "",
      slide.slide_role === "cta" ? "visual de fechamento com destaque para call-to-action" : "",
    ].filter(Boolean),
  }, null, 2);

  const vertexPayload = {
    contents: [{ role: "user", parts: [{ text: slidePrompt }, ...imagesParts] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
  };

  // Retry logic for single image
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(10000 * Math.pow(2, attempt - 1), 60000);
        console.log(`Retry ${attempt} for slide ${slide.slide_number}, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const startTime = Date.now();
      const res = await fetch(vertexEndpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(vertexPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Vertex AI error (${res.status}): ${errText.substring(0, 500)}`);
      }

      const result = await res.json();
      let imageData: { base64: string; mimeType: string } | null = null;
      for (const candidate of (result.candidates || [])) {
        for (const part of (candidate.content?.parts || [])) {
          if (part.inlineData?.data) {
            imageData = { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
            break;
          }
        }
        if (imageData) break;
      }

      if (!imageData) throw new Error("No image in Vertex AI response");

      // Upload to storage
      const ext = imageData.mimeType.includes("jpeg") || imageData.mimeType.includes("jpg") ? "jpg" : "png";
      const fileName = `carousel-${crypto.randomUUID()}.${ext}`;
      const binaryStr = atob(imageData.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);

      const { error: uploadErr } = await supabaseAdmin.storage
        .from("generated-creatives")
        .upload(fileName, bytes, { contentType: imageData.mimeType, upsert: false });
      if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabaseAdmin.storage.from("generated-creatives").getPublicUrl(fileName);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Slide ${slide.slide_number} generated and uploaded in ${elapsed}s`);

      return new Response(
        JSON.stringify({ image_url: urlData.publicUrl, slide_number: slide.slide_number }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(`Slide ${slide.slide_number} attempt ${attempt + 1} failed:`, lastError);
      if (!lastError.includes("429") && !lastError.includes("RESOURCE_EXHAUSTED")) break;
    }
  }

  return new Response(
    JSON.stringify({ error: `Falha ao gerar slide ${slide.slide_number}: ${lastError}` }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
