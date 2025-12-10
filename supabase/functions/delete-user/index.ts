import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user: currentUser },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !currentUser) {
      throw new Error("Unauthorized");
    }

    const { data: userData, error: userError } = await supabaseClient
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (userError || !userData || userData.role !== "admin") {
      throw new Error("Only admins can delete users");
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      throw new Error("Missing userId parameter");
    }

    if (userId === currentUser.id) {
      throw new Error("Cannot delete your own account");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { error: profileError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);

    if (profileError) {
      throw new Error(`Failed to delete user profile: ${profileError.message}`);
    }

    const { error: authError2 } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError2) {
      console.error("Failed to delete auth user (profile already deleted):", authError2);
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An error occurred",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});