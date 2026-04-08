import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
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

    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email é obrigatório" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find user by email
    let user = null;
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const found = data?.users?.find((u) => u.email === email);
      if (found) {
        user = found;
        break;
      }
      if (!data?.users || data.users.length < perPage) break;
      page++;
    }

    if (!user) {
      console.log(`delete-user-refund: user not found for email=${email}`);
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado", email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const userId = user.id;
    console.log(`delete-user-refund: deleting user ${userId} (${email})`);

    // Delete related data in order (child tables first)
    await supabaseAdmin.from("generated_creatives").delete().eq("user_id", userId);
    await supabaseAdmin.from("creative_requests").delete().eq("user_id", userId);
    await supabaseAdmin.from("carousel_requests").delete().eq("user_id", userId);
    await supabaseAdmin.from("credit_transactions").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_credits").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

    // Delete auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    console.log(`delete-user-refund: successfully deleted user ${userId} (${email})`);

    return new Response(
      JSON.stringify({ success: true, email, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("delete-user-refund error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
