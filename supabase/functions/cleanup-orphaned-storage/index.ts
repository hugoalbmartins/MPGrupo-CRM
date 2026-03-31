import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: allSales, error: salesError } = await supabase
      .from("sales")
      .select("id");

    if (salesError) throw salesError;

    const validSaleIds = new Set((allSales || []).map((s: { id: string }) => s.id));

    const buckets = ["sales-documents", "operator-documents"];
    let totalDeleted = 0;
    let totalBytesReclaimed = 0;
    const details: { bucket: string; folder: string; files: number; size: number }[] = [];

    for (const bucket of buckets) {
      if (bucket === "sales-documents") {
        const { data: folders, error: listError } = await supabase.storage
          .from(bucket)
          .list("", { limit: 1000 });

        if (listError) {
          console.error(`Error listing ${bucket}:`, listError.message);
          continue;
        }

        for (const folder of folders || []) {
          if (!folder.name || folder.name === ".emptyFolderPlaceholder") continue;

          if (validSaleIds.has(folder.name)) continue;

          const { data: files, error: filesError } = await supabase.storage
            .from(bucket)
            .list(folder.name, { limit: 500 });

          if (filesError) {
            console.error(`Error listing folder ${folder.name}:`, filesError.message);
            continue;
          }

          if (!files || files.length === 0) continue;

          const paths = files
            .filter((f: { name: string }) => f.name !== ".emptyFolderPlaceholder")
            .map((f: { name: string }) => `${folder.name}/${f.name}`);

          if (paths.length === 0) continue;

          let folderSize = 0;
          for (const f of files) {
            if (f.metadata && f.metadata.size) {
              folderSize += Number(f.metadata.size);
            }
          }

          const { error: removeError } = await supabase.storage
            .from(bucket)
            .remove(paths);

          if (removeError) {
            console.error(`Error removing files in ${folder.name}:`, removeError.message);
          } else {
            totalDeleted += paths.length;
            totalBytesReclaimed += folderSize;
            details.push({
              bucket,
              folder: folder.name,
              files: paths.length,
              size: folderSize,
            });
            console.log(
              `Deleted ${paths.length} orphaned files from ${bucket}/${folder.name} (~${Math.round(folderSize / 1024)}KB)`
            );
          }
        }
      }
    }

    const summary = {
      success: true,
      total_files_deleted: totalDeleted,
      total_bytes_reclaimed: totalBytesReclaimed,
      total_mb_reclaimed: Math.round(totalBytesReclaimed / 1024 / 1024),
      folders_cleaned: details.length,
      details,
    };

    console.log(`Orphan cleanup complete: ${totalDeleted} files, ~${summary.total_mb_reclaimed}MB reclaimed`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Orphan cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
