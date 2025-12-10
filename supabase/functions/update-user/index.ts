import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UpdateUserRequest {
  userId: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  position: string;
  partner_id?: string;
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
      throw new Error("Only admins can update users");
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

    const requestData: UpdateUserRequest = await req.json();

    if (!requestData.userId || !requestData.name || !requestData.email || !requestData.role || !requestData.position) {
      throw new Error("Missing required fields");
    }

    const updateData: any = {
      name: requestData.name,
      email: requestData.email,
      role: requestData.role,
      position: requestData.position,
      partner_id: requestData.partner_id || null,
    };

    if (requestData.password) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        requestData.userId,
        { password: requestData.password }
      );

      if (passwordError) {
        throw passwordError;
      }

      updateData.must_change_password = true;
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", requestData.userId)
      .select()
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to update user profile: ${profileError.message}`);
    }

    if (!profileData) {
      throw new Error("User not found or update failed");
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: profileData,
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