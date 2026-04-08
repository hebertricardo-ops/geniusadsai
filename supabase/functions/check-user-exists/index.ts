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

    // Paginate through all users to find by email
    let user = null;
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw error;

      const found = data?.users?.find((u) => u.email === email);
      if (found) {
        user = found;
        break;
      }

      // No more pages
      if (!data?.users || data.users.length < perPage) break;
      page++;
    }

    console.log(`check-user-exists: email=${email}, found=${!!user}, userId=${user?.id ?? 'none'}`);

    if (user) {
      const { data: credits } = await supabaseAdmin
        .from("user_credits")
        .select("credits_balance")
        .eq("user_id", user.id)
        .single();

      return new Response(
        JSON.stringify({
          exists: true,
          userId: user.id,
          email,
          creditsBalance: credits?.credits_balance ?? 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ exists: false, email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("check-user-exists error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
