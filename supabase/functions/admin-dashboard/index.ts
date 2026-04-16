import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user || user.email !== "hebertricardo@gmail.com") {
      return new Response(JSON.stringify({ error: "Unauthorized - Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, table_name } = await req.json();

    if (action === "get_metadata") {
      // Get all tables
      const { data: tables } = await supabaseAdmin.rpc("", {}).maybeSingle();
      const tablesQuery = await supabaseAdmin.from("").select();
      
      // Use raw SQL via postgres
      const tablesResult = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
      });

      // Query information_schema for tables
      const { data: tablesData, error: tablesError } = await supabaseAdmin
        .rpc("pg_tables_info" as any, {});

      // Fallback: use direct SQL query via PostgREST
      // We'll query each known table for count
      const knownTables = [
        "profiles", "user_credits", "credit_transactions",
        "creative_requests", "generated_creatives", "carousel_requests",
        "email_send_log", "email_send_state", "email_unsubscribe_tokens",
        "suppressed_emails"
      ];

      const tableInfo = [];
      for (const tableName of knownTables) {
        try {
          const { count } = await supabaseAdmin
            .from(tableName)
            .select("*", { count: "exact", head: true });
          tableInfo.push({ name: tableName, row_count: count || 0 });
        } catch {
          tableInfo.push({ name: tableName, row_count: -1 });
        }
      }

      // Get storage buckets
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();

      return new Response(JSON.stringify({
        tables: tableInfo,
        buckets: buckets || [],
        connection: {
          supabase_url: supabaseUrl,
          anon_key: anonKey,
          project_ref: supabaseUrl.replace("https://", "").replace(".supabase.co", ""),
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_table_data") {
      if (!table_name) {
        return new Response(JSON.stringify({ error: "table_name required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin
        .from(table_name)
        .select("*")
        .limit(1000);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ data: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_table_schema") {
      if (!table_name) {
        return new Response(JSON.stringify({ error: "table_name required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get columns info via PostgREST OpenAPI
      const schemaRes = await fetch(`${supabaseUrl}/rest/v1/${table_name}?limit=0`, {
        method: "GET",
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Accept": "application/json",
          "Prefer": "return=representation",
        },
      });

      // Get OpenAPI definition for column info
      const openApiRes = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Accept": "application/openapi+json",
        },
      });

      let columns: any[] = [];
      try {
        const openApi = await openApiRes.json();
        const tableDef = openApi?.definitions?.[table_name];
        if (tableDef?.properties) {
          columns = Object.entries(tableDef.properties).map(([name, def]: [string, any]) => ({
            name,
            type: def.format || def.type || "unknown",
            description: def.description || "",
            default: def.default ?? null,
          }));
        }
      } catch {}

      return new Response(JSON.stringify({ columns }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_storage_files") {
      const bucket_name = table_name; // reuse field
      if (!bucket_name) {
        return new Response(JSON.stringify({ error: "bucket name required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin.storage
        .from(bucket_name)
        .list("", { limit: 100 });

      return new Response(JSON.stringify({ files: data || [], error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
