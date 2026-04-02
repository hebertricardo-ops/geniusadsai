import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_MAP: Record<string, { priceId: string; credits: number }> = {
  basico: { priceId: "price_1THpcrIHwK20nCZlGoGCTqAY", credits: 20 },
  pro: { priceId: "price_1THpebIHwK20nCZlHCAAdR8o", credits: 50 },
  plus: { priceId: "price_1THpevIHwK20nCZlN0XaQXGH", credits: 100 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { packageId } = await req.json();
    const pkg = PRICE_MAP[packageId];
    if (!pkg) throw new Error("Pacote inválido");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: pkg.priceId, quantity: 1 }],
      mode: "payment",
      payment_method_types: ["card", "link"],
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}&package=${packageId}`,
      cancel_url: `${req.headers.get("origin")}/#pricing`,
      metadata: {
        credits: pkg.credits.toString(),
        package: packageId,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
