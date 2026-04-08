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
    // Validate webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    if (!expectedSecret || webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { email, name, packageId } = await req.json();

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

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;

      const { data: currentCredits } = await supabaseAdmin
        .from("user_credits")
        .select("credits_balance")
        .eq("user_id", userId)
        .single();

      if (currentCredits) {
        await supabaseAdmin
          .from("user_credits")
          .update({ credits_balance: currentCredits.credits_balance + credits })
          .eq("user_id", userId);
      }
    } else {
      isNewUser = true;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "123456",
        email_confirm: true,
        user_metadata: { name: name || email.split("@")[0], must_change_password: true },
      });

      if (createError || !newUser.user) {
        throw new Error("Erro ao criar conta: " + (createError?.message || "desconhecido"));
      }

      userId = newUser.user.id;

      // Wait for triggers to create profile and credits
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const { data: currentCredits } = await supabaseAdmin
        .from("user_credits")
        .select("credits_balance")
        .eq("user_id", userId)
        .single();

      if (currentCredits) {
        await supabaseAdmin
          .from("user_credits")
          .update({ credits_balance: currentCredits.credits_balance + credits })
          .eq("user_id", userId);
      } else {
        await supabaseAdmin
          .from("user_credits")
          .insert({ user_id: userId, credits_balance: credits + 4, credits_used: 0 });
      }
    }

    // Log transaction
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      amount: credits,
      type: "purchase",
      description: `Compra de ${credits} créditos via Hotmart (${packageId})`,
    });

    return new Response(
      JSON.stringify({ success: true, isNewUser, email, credits }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("create-user-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
