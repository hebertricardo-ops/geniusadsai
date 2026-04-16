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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user || user.email !== "hebertricardo@gmail.com") {
      return new Response(JSON.stringify({ error: "Unauthorized - Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, table_name } = await req.json();

    if (action === "get_metadata") {
      const knownTables = [
        "profiles", "user_credits", "credit_transactions",
        "creative_requests", "generated_creatives", "carousel_requests",
        "email_send_log", "email_send_state", "email_unsubscribe_tokens",
        "suppressed_emails"
      ];

      const tableInfo = [];
      for (const tableName of knownTables) {
        const { count } = await supabaseAdmin
          .from(tableName)
          .select("*", { count: "exact", head: true });
        tableInfo.push({ name: tableName, row_count: count ?? 0 });
      }

      const { data: buckets } = await supabaseAdmin.storage.listBuckets();

      return new Response(JSON.stringify({
        tables: tableInfo,
        buckets: buckets || [],
        connection: {
          supabase_url: supabaseUrl,
          anon_key: anonKey,
          project_ref: supabaseUrl.replace("https://", "").replace(".supabase.co", ""),
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_table_data") {
      if (!table_name) {
        return new Response(JSON.stringify({ error: "table_name required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabaseAdmin.from(table_name).select("*").limit(1000);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ data: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_table_schema") {
      if (!table_name) {
        return new Response(JSON.stringify({ error: "table_name required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
      const bucket_name = table_name;
      if (!bucket_name) {
        return new Response(JSON.stringify({ error: "bucket name required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabaseAdmin.storage.from(bucket_name).list("", { limit: 100 });
      return new Response(JSON.stringify({ files: data || [], error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_function_code") {
      const fnName = table_name;
      if (!fnName) {
        return new Response(JSON.stringify({ error: "function name required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const possiblePaths = [
          `/home/deno/functions/${fnName}/index.ts`,
          `/home/deno/functions/${fnName}/index.js`,
          `/var/task/functions/${fnName}/index.ts`,
          `/tmp/functions/${fnName}/index.ts`,
          `./functions/${fnName}/index.ts`,
          `./${fnName}/index.ts`,
          `../${fnName}/index.ts`,
          `/src/functions/${fnName}/index.ts`,
        ];
        
        let code = "";
        let foundPath = "";
        
        // Try to discover the actual path
        let debugInfo = "";
        try {
          const cwd = Deno.cwd();
          debugInfo += `CWD: ${cwd}\n`;
          try {
            for await (const entry of Deno.readDir(cwd)) {
              debugInfo += `  ${entry.name} (${entry.isDirectory ? 'dir' : 'file'})\n`;
            }
          } catch {}
          try {
            for await (const entry of Deno.readDir("/home/deno")) {
              debugInfo += `  /home/deno/${entry.name} (${entry.isDirectory ? 'dir' : 'file'})\n`;
            }
          } catch (e) {
            debugInfo += `  /home/deno: ${e.message}\n`;
          }
        } catch {}
        
        for (const p of possiblePaths) {
          try {
            code = await Deno.readTextFile(p);
            foundPath = p;
            break;
          } catch { /* try next */ }
        }
        
        if (!code) {
          // Also try reading relative to import.meta.url
          try {
            const baseUrl = new URL(".", import.meta.url);
            const siblingUrl = new URL(`../${fnName}/index.ts`, baseUrl);
            const resp = await fetch(siblingUrl);
            if (resp.ok) {
              code = await resp.text();
              foundPath = siblingUrl.toString();
            }
          } catch {}
        }
        
        if (!code) {
          code = `// Código não encontrado.\n// Debug:\n${debugInfo}`;
        }
        
        return new Response(JSON.stringify({ code, path: foundPath }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
