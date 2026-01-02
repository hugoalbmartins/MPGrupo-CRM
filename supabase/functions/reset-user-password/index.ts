import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ResetPasswordRequest {
  user_id: string;
  new_password: string;
}

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
      throw new Error("Only admins can reset passwords");
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

    const requestData: ResetPasswordRequest = await req.json();

    if (!requestData.user_id || !requestData.new_password) {
      throw new Error("Missing required fields: user_id and new_password");
    }

    if (requestData.new_password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      requestData.user_id,
      { password: requestData.new_password }
    );

    if (updateError) {
      throw new Error(`Failed to reset password: ${updateError.message}`);
    }

    const { error: profileError } = await supabaseAdmin
      .from("users")
      .update({ must_change_password: true })
      .eq("id", requestData.user_id);

    if (profileError) {
      console.error("Failed to update must_change_password flag:", profileError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset successfully",
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
    console.error("Error resetting password:", error);
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