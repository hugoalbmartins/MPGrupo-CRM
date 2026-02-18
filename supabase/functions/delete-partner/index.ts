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

    // Collect all user IDs linked to this partner before deletion
    const { data: partnerUsers, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("partner_id", partnerId);

    if (usersError) throw new Error(`Failed to fetch partner users: ${usersError.message}`);

    const userIdsToDelete = (partnerUsers ?? [])
      .map(u => u.id)
      .filter(id => id !== currentUser.id);

    // Deleting the partner cascades: users, commission_reports, partner_advances,
    // partner_d2d_operator_levels, push_subscriptions (via users cascade).
    // sales.partner_id and forms.partner_id are SET NULL.
    const { error: partnerError } = await supabaseAdmin
      .from("partners")
      .delete()
      .eq("id", partnerId);

    if (partnerError) throw new Error(`Failed to delete partner: ${partnerError.message}`);

    // Delete Supabase auth users (not handled by DB cascade)
    let authDeletedCount = 0;
    for (const userId of userIdsToDelete) {
      const { error: authDelError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authDelError) {
        console.error(`Failed to delete auth user ${userId}:`, authDelError.message);
      } else {
        authDeletedCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, users_deleted: authDeletedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "An error occurred" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
