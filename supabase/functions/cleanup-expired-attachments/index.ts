import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EXPIRY_DAYS = 45;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - EXPIRY_DAYS);

    console.log(`Cleaning attachments: cutoff=${cutoff.toISOString()} (${EXPIRY_DAYS} days)`);

    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("id, sale_code, attachments, notes");

    if (salesError) throw salesError;

    let totalDeleted = 0;
    let totalMarked = 0;
    const activePaths = new Set<string>();

    for (const sale of sales || []) {
      let saleUpdated = false;
      const updatedAttachments = [...(sale.attachments || [])];
      const updatedNotes = [...(sale.notes || [])];

      for (let i = 0; i < updatedAttachments.length; i++) {
        const att = updatedAttachments[i];
        if (att.expired) continue;
        if (!att.uploaded_at) continue;

        const uploadedAt = new Date(att.uploaded_at);

        if (uploadedAt < cutoff) {
          if (att.path) {
            const { error: removeError } = await supabase.storage
              .from("sales-documents")
              .remove([att.path]);

            if (removeError) {
              console.error(`Failed to remove file ${att.path}:`, removeError.message);
            } else {
              totalDeleted++;
            }
          }

          updatedAttachments[i] = {
            id: att.id,
            filename: att.filename,
            uploaded_at: att.uploaded_at,
            uploaded_by: att.uploaded_by || null,
            expired: true,
            expired_at: new Date().toISOString(),
          };
          saleUpdated = true;
          totalMarked++;
        } else {
          if (att.path) activePaths.add(att.path);
        }
      }

      for (let ni = 0; ni < updatedNotes.length; ni++) {
        const note = updatedNotes[ni];
        if (!note.attachments || note.attachments.length === 0) continue;

        const noteAtts = [...note.attachments];
        let noteUpdated = false;

        for (let ai = 0; ai < noteAtts.length; ai++) {
          const att = noteAtts[ai];
          if (att.expired) continue;
          if (!att.uploaded_at) continue;

          const uploadedAt = new Date(att.uploaded_at);

          if (uploadedAt < cutoff) {
            if (att.path) {
              const { error: removeError } = await supabase.storage
                .from("sales-documents")
                .remove([att.path]);

              if (removeError) {
                console.error(`Failed to remove note file ${att.path}:`, removeError.message);
              } else {
                totalDeleted++;
              }
            }

            noteAtts[ai] = {
              id: att.id,
              filename: att.filename,
              uploaded_at: att.uploaded_at,
              expired: true,
              expired_at: new Date().toISOString(),
            };
            noteUpdated = true;
            totalMarked++;
          } else {
            if (att.path) activePaths.add(att.path);
          }
        }

        if (noteUpdated) {
          updatedNotes[ni] = { ...note, attachments: noteAtts };
          saleUpdated = true;
        }
      }

      if (saleUpdated) {
        const { error: updateError } = await supabase
          .from("sales")
          .update({ attachments: updatedAttachments, notes: updatedNotes })
          .eq("id", sale.id);

        if (updateError) {
          console.error(`Failed to update sale ${sale.id}:`, updateError.message);
        }
      }
    }

    let orphanedDeleted = 0;
    const { data: storageObjects, error: listError } = await supabase.storage
      .from("sales-documents")
      .list("", { limit: 1000 });

    if (!listError && storageObjects) {
      for (const folder of storageObjects) {
        const { data: files, error: filesError } = await supabase.storage
          .from("sales-documents")
          .list(folder.name, { limit: 1000 });

        if (filesError || !files) continue;

        for (const file of files) {
          const fullPath = `${folder.name}/${file.name}`;
          if (!activePaths.has(fullPath)) {
            const { error: removeError } = await supabase.storage
              .from("sales-documents")
              .remove([fullPath]);

            if (!removeError) {
              orphanedDeleted++;
            } else {
              console.error(`Failed to remove orphaned file ${fullPath}:`, removeError.message);
            }
          }
        }
      }
    }

    console.log(`Cleanup complete: ${totalDeleted} expired files deleted, ${totalMarked} attachments marked, ${orphanedDeleted} orphaned files removed`);

    return new Response(
      JSON.stringify({
        success: true,
        files_deleted: totalDeleted,
        attachments_marked_expired: totalMarked,
        orphaned_files_deleted: orphanedDeleted,
        cutoff_date: cutoff.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
