import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 1024, height: 1280 },
  "9:16": { width: 1024, height: 1820 },
  "16:9": { width: 1820, height: 1024 },
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

    // Validate inputs
    if (!image_urls?.length) throw new Error("At least one image is required");
    if (!product_name || !headline || !cta || !visual_option) throw new Error("Missing required fields");

    const numImages = Math.min(Math.max(1, quantity || 1), 4);
    const dimensions = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS["1:1"];

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

    // Call fal.ai nano-banana-pro/edit
    const falResponse = await fetch("https://queue.fal.run/fal-ai/nano-banana-pro/edit", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: image_urls[0],
        prompt,
        image_size: {
          width: dimensions.width,
          height: dimensions.height,
        },
        num_images: numImages,
        safety_tolerance: 2,
      }),
    });

    if (!falResponse.ok) {
      const errText = await falResponse.text();
      console.error("fal.ai error:", falResponse.status, errText);
      throw new Error(`fal.ai error: ${falResponse.status}`);
    }

    const falData = await falResponse.json();

    // Check if queued (async mode)
    if (falData.request_id && !falData.images) {
      // Poll for result
      const requestId = falData.request_id;
      let result = null;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests/${requestId}/status`, {
          headers: { Authorization: `Key ${FAL_KEY}` },
        });
        const statusData = await statusRes.json();
        if (statusData.status === "COMPLETED") {
          const resultRes = await fetch(`https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests/${requestId}`, {
            headers: { Authorization: `Key ${FAL_KEY}` },
          });
          result = await resultRes.json();
          break;
        }
        if (statusData.status === "FAILED") {
          throw new Error("fal.ai generation failed");
        }
      }
      if (!result) throw new Error("fal.ai generation timed out");

      return new Response(JSON.stringify({
        images: result.images || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync response
    return new Response(JSON.stringify({
      images: falData.images || [],
    }), {
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
