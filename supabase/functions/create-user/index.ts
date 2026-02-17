import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: string;
  position: string;
  partner_id?: string;
  is_commissioned?: boolean;
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

    const callerRole = userData?.role;
    const isAdmin = callerRole === "admin";
    const isBo = callerRole === "bo";

    if (userError || !userData || (!isAdmin && !isBo)) {
      throw new Error("Only admins and backoffice users can create users");
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

    const requestData: CreateUserRequest = await req.json();

    if (!requestData.name || !requestData.email || !requestData.password || !requestData.role || !requestData.position) {
      throw new Error("Missing required fields");
    }

    const partnerOnlyRoles = ['partner', 'partner_commercial'];
    if (isBo && !partnerOnlyRoles.includes(requestData.role)) {
      throw new Error("Backoffice users can only create partner accounts");
    }

    // Validate email for specific roles
    const restrictedRoles = ['admin', 'bo', 'gestor_nv1', 'gestor_nv2'];
    if (restrictedRoles.includes(requestData.role)) {
      const emailDomain = requestData.email.split('@')[1];
      if (emailDomain !== 'mpgrupo.pt' && emailDomain !== 'marciopinto.pt') {
        throw new Error(`Users with role ${requestData.role} must have email ending in @mpgrupo.pt or @marciopinto.pt`);
      }
    }

    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
    const userAlreadyExists = existingAuthUser?.users?.some(u => u.email === requestData.email);
    
    if (userAlreadyExists) {
      const orphanUser = existingAuthUser?.users?.find(u => u.email === requestData.email);
      if (orphanUser) {
        const { data: existingProfile } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("id", orphanUser.id)
          .maybeSingle();
        
        if (!existingProfile) {
          await supabaseAdmin.auth.admin.deleteUser(orphanUser.id);
          console.log(`Cleaned up orphan auth user: ${orphanUser.id}`);
        } else {
          throw new Error("Este email já está registado. Por favor, use outro email.");
        }
      } else {
        throw new Error("Este email já está registado. Por favor, use outro email.");
      }
    }

    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: requestData.email,
      password: requestData.password,
      email_confirm: true,
      user_metadata: {
        name: requestData.name,
        role: requestData.role,
      },
    });

    if (signUpError) {
      if (signUpError.message?.includes("already registered") || signUpError.status === 422) {
        throw new Error("Este email já está registado. Por favor, use outro email.");
      }
      throw signUpError;
    }

    if (!authData?.user) {
      throw new Error("Failed to create auth user");
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authData.user.id,
        name: requestData.name,
        email: requestData.email,
        role: requestData.role,
        position: requestData.position,
        partner_id: requestData.partner_id || null,
        must_change_password: true,
        is_commissioned: requestData.is_commissioned || false,
      })
      .select()
      .maybeSingle();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    if (!profileData) {
      throw new Error("User profile created but not returned from database");
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { ...profileData, initial_password: requestData.password },
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
    console.error("Error creating user:", error);
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
