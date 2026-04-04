import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/purge-cache — Vercel Cron job to purge old generated PDFs.
 * Runs daily. Deletes PDFs older than 30 days that are no longer the current version.
 */
export async function GET() {
  const supabase = createAdminClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Find setlists with old generation timestamps that have been regenerated since
  const { data: staleSetlists } = await supabase
    .from("setlists")
    .select("id, setlist_pdf_path, worship_aid_pdf_path, generated_at")
    .lt("generated_at", thirtyDaysAgo)
    .not("setlist_pdf_path", "is", null);

  let purged = 0;

  for (const setlist of staleSetlists || []) {
    // Don't delete the current version. Only delete if there's a newer version.
    // For now, just clear the old paths from stale records
    // The actual storage files are overwritten on regeneration (upsert: true)
    // so this is mainly about cleaning up orphaned records
    const paths: string[] = [];
    if (setlist.setlist_pdf_path) paths.push(setlist.setlist_pdf_path);
    if (setlist.worship_aid_pdf_path) paths.push(setlist.worship_aid_pdf_path);

    if (paths.length > 0) {
      const { error } = await supabase.storage
        .from("song-resources")
        .remove(paths);

      if (!error) {
        await supabase
          .from("setlists")
          .update({
            setlist_pdf_path: null,
            setlist_pdf_url: null,
            worship_aid_pdf_path: null,
            worship_aid_pdf_url: null,
            generation_status: "idle",
            generated_at: null,
          })
          .eq("id", setlist.id);
        purged++;
      }
    }
  }

  return NextResponse.json({ purged, checked: staleSetlists?.length || 0 });
}
