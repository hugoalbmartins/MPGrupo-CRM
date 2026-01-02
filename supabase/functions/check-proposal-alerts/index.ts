import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: checkError } = await supabase.rpc("check_proposal_alerts");

    if (checkError) {
      throw checkError;
    }

    const { data: newAlerts, error: alertsError } = await supabase
      .from("alerts")
      .select("*")
      .eq("type", "proposal_pending")
      .gte("created_at", new Date(Date.now() - 60000).toISOString())
      .order("created_at", { ascending: false });

    if (alertsError) {
      throw alertsError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Proposal alerts checked successfully",
        alerts_created: newAlerts?.length || 0,
        alerts: newAlerts,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});