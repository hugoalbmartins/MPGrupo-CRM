import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.86.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: currentUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !currentUser) throw new Error("Unauthorized");

    const { data: userData, error: userError } = await supabaseClient
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (userError || !userData || !["admin", "bo"].includes(userData.role)) {
      throw new Error("Only admins and backoffice can delete partners");
    }

    const url = new URL(req.url);
    const partnerId = url.searchParams.get("partnerId");
    if (!partnerId) throw new Error("Missing partnerId parameter");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: partnerUsers, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("partner_id", partnerId);

    if (usersError) throw new Error(`Failed to fetch partner users: ${usersError.message}`);

    for (const partnerUser of partnerUsers ?? []) {
      if (partnerUser.id === currentUser.id) continue;

      await supabaseAdmin.from("users").delete().eq("id", partnerUser.id);
      const { error: authDelError } = await supabaseAdmin.auth.admin.deleteUser(partnerUser.id);
      if (authDelError) {
        console.error(`Failed to delete auth user ${partnerUser.id}:`, authDelError.message);
      }
    }

    const { error: partnerError } = await supabaseAdmin
      .from("partners")
      .delete()
      .eq("id", partnerId);

    if (partnerError) throw new Error(`Failed to delete partner: ${partnerError.message}`);

    return new Response(
      JSON.stringify({ success: true, users_deleted: (partnerUsers ?? []).length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "An error occurred" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
