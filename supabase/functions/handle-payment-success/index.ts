import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CREDITS_MAP: Record<string, number> = {
  "PACOTE BASICO": 20,
  "PACOTE PRO": 50,
  "PACOTE PLUS": 100,
};

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { sessionId, packageId } = await req.json();
    if (!sessionId || !packageId) throw new Error("Dados inválidos");

    const credits = CREDITS_MAP[packageId];
    if (!credits) throw new Error("Pacote inválido");

    // Verify Stripe session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      throw new Error("Pagamento não confirmado");
    }

    const email = session.customer_details?.email;
    if (!email) throw new Error("Email não encontrado na sessão");

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;
    let tempPassword: string | null = null;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;

      // Add credits to existing user
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
      // Create new user with temp password
      isNewUser = true;
      tempPassword = generateTempPassword();

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: email.split("@")[0], must_change_password: true },
      });

      if (createError || !newUser.user) {
        throw new Error("Erro ao criar conta: " + (createError?.message || "desconhecido"));
      }

      userId = newUser.user.id;

      // Wait a moment for triggers to create profile and credits
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update credits (trigger gives 10, we add the purchased amount minus the default)
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
        // If trigger didn't fire, create manually
        await supabaseAdmin
          .from("user_credits")
          .insert({ user_id: userId, credits_balance: credits + 4, credits_used: 0 });
      }
    }

    // Log the transaction
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      amount: credits,
      type: "purchase",
      description: `Compra de ${credits} créditos via Stripe (${packageId})`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        isNewUser,
        tempPassword,
        email,
        credits,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("handle-payment-success error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
