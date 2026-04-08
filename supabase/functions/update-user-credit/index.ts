import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const CREDITS_MAP: Record<string, number> = {
  "PACOTE BASICO": 20,
  "PACOTE PRO": 50,
  "PACOTE PLUS": 100,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    if (!expectedSecret || webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { email, packageId } = await req.json();

    if (!email || !packageId) {
      return new Response(JSON.stringify({ error: "email e packageId são obrigatórios" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const credits = CREDITS_MAP[packageId];
    if (!credits) {
      return new Response(JSON.stringify({ error: "packageId inválido. Use: PACOTE BASICO, PACOTE PRO, PACOTE PLUS" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users?.find((u) => u.email === email);
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Get current balance
    const { data: currentCredits } = await supabaseAdmin
      .from("user_credits")
      .select("credits_balance")
      .eq("user_id", user.id)
      .single();

    if (!currentCredits) {
      return new Response(JSON.stringify({ error: "Registro de créditos não encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const newBalance = currentCredits.credits_balance + credits;

    // Update balance
    await supabaseAdmin
      .from("user_credits")
      .update({ credits_balance: newBalance })
      .eq("user_id", user.id);

    // Log transaction
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: user.id,
      amount: credits,
      type: "purchase",
      description: `Compra de ${credits} créditos via Hotmart (${packageId})`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        email,
        packageId,
        creditsAdded: credits,
        newBalance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("update-user-credit error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
