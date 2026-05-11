import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user's JWT and check admin role
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    });
    const userData = await userRes.json();
    if (!userData.id) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const roleRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=role&id=eq.${userData.id}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    const roleData = await roleRes.json();
    if (!roleData?.[0]?.role || roleData[0].role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dbHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    if (req.method === "GET") {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/system_settings?select=setting_value,updated_at&setting_key=eq.smtp_config`,
        { headers: dbHeaders }
      );
      const data = await res.json();

      if (!data?.[0]?.setting_value) {
        return new Response(JSON.stringify({ error: "SMTP config not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = data[0].setting_value;
      config.smtp_password_set = !!(Deno.env.get("SMTP_PASS"));

      return new Response(
        JSON.stringify({ config, updated_at: data[0].updated_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await req.json();
      const newConfig = body.config;

      if (!newConfig) {
        return new Response(JSON.stringify({ error: "Missing config" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const requiredFields = ["smtp_host", "smtp_port", "smtp_user", "from_email", "from_name"];
      for (const field of requiredFields) {
        if (!newConfig[field] && newConfig[field] !== 0) {
          return new Response(JSON.stringify({ error: `Missing field: ${field}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      delete newConfig.smtp_password;
      delete newConfig.smtp_password_set;

      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/system_settings?setting_key=eq.smtp_config`,
        {
          method: "PATCH",
          headers: dbHeaders,
          body: JSON.stringify({
            setting_value: newConfig,
            updated_by: userData.id,
          }),
        }
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return new Response(JSON.stringify({ error: "Failed to save", details: errText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Configuracao SMTP guardada com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
