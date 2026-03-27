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
  promise: string;
  pains: string;
  benefits: string;
  objections?: string;
  headline: string;
  body: string;
  cta: string;
  visual_option: {
    visual_description: string;
    element_distribution: string;
    composition: string;
    visual_hierarchy: string;
    layout_style: string;
    cta_highlight: string;
  };
}): string {
  return `Create a premium static ad creative for digital advertising.

Product: ${data.product_name}
Promise: ${data.promise}
Pain points: ${data.pains}
Benefits: ${data.benefits}
${data.objections ? `Objections addressed: ${data.objections}` : ""}

Headline: ${data.headline}
Body copy: ${data.body}
CTA: ${data.cta}

Visual direction: ${data.visual_option.visual_description}
Layout style: ${data.visual_option.layout_style}
Composition: ${data.visual_option.composition}
Visual hierarchy: ${data.visual_option.visual_hierarchy}
Element distribution: ${data.visual_option.element_distribution}
CTA highlight: ${data.visual_option.cta_highlight}

Rules:
- Compose a clean, professional static ad creative
- Use the provided reference images as base elements for the product
- Maintain clear visual hierarchy and readability
- Reserve appropriate areas for text overlays (headline, body, CTA)
- Premium digital advertising atmosphere
- Highlight product/offer/benefit prominently
- Improve composition, contrast and visual impact
- Avoid visual clutter — keep it polished
- Conversion-oriented professional look
- The creative should look like a real paid ad on Instagram/Facebook
- Do NOT add any text to the image — only visual composition`;
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
      console.log("fal.ai queued, polling request_id:", requestId);

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));

        const statusRes = await fetch(
          `https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests/${requestId}/status`,
          { headers: { Authorization: `Key ${FAL_KEY}` } }
        );
        const statusData = await safeJsonParse(statusRes, "fal.ai status poll");

        if (statusData.status === "COMPLETED") {
          const resultRes = await fetch(
            `https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests/${requestId}`,
            { headers: { Authorization: `Key ${FAL_KEY}` } }
          );
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
