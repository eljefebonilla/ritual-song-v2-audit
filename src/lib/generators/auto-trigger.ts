import { createAdminClient } from "../supabase/admin";
import { isSetlistComplete, computeSetlistHash } from "./completeness";
import { generateSetlistPdf } from "./setlist-generator";
import { generateWorshipAidPdf } from "./worship-aid-generator";
import { checkRateLimit } from "./rate-limiter";
import type { SetlistSongRow } from "../booking-types";

/**
 * Check if a setlist is complete and auto-generate PDFs if so.
 * Called fire-and-forget from setlist save endpoints.
 * Skips if incomplete, unchanged, or rate-limited.
 */
export async function triggerGenerationIfReady(
  setlistId: string,
  songs: unknown
): Promise<void> {
  const songRows = (songs || []) as SetlistSongRow[];

  if (!isSetlistComplete(songRows)) return;

  const supabase = createAdminClient();

  // Fetch current state
  const { data: setlist } = await supabase
    .from("setlists")
    .select("mass_event_id, content_hash, generation_status")
    .eq("id", setlistId)
    .single();

  if (!setlist) return;

  // Skip if unchanged
  const newHash = computeSetlistHash(songRows);
  if (setlist.content_hash === newHash && setlist.generation_status === "ready") return;

  // Get parish ID from the mass event creator's profile
  const { data: massEvent } = await supabase
    .from("mass_events")
    .select("id, created_by")
    .eq("id", setlist.mass_event_id)
    .single();

  if (!massEvent) return;

  let parishId: string | null = null;
  if (massEvent.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("parish_id")
      .eq("id", massEvent.created_by)
      .single();
    parishId = profile?.parish_id || null;
  }

  // Fallback: get any parish (single-parish deployment)
  if (!parishId) {
    const { data: parishes } = await supabase
      .from("parishes")
      .select("id")
      .limit(1);
    parishId = parishes?.[0]?.id || null;
  }

  if (!parishId) return;

  // Rate check
  const rateCheck = checkRateLimit(`gen:${parishId}`);
  if (!rateCheck.allowed) return;

  // Mark generating
  await supabase
    .from("setlists")
    .update({ generation_status: "generating", generation_error: null })
    .eq("id", setlistId);

  try {
    const [setlistResult, worshipAidResult] = await Promise.all([
      generateSetlistPdf({ massEventId: setlist.mass_event_id, parishId }),
      generateWorshipAidPdf({ massEventId: setlist.mass_event_id, parishId }),
    ]);

    await supabase
      .from("setlists")
      .update({
        generation_status: setlistResult.success && worshipAidResult.success ? "ready" : "failed",
        generated_at: new Date().toISOString(),
        setlist_pdf_path: setlistResult.storagePath || null,
        setlist_pdf_url: setlistResult.pdfUrl || null,
        worship_aid_pdf_path: worshipAidResult.storagePath || null,
        worship_aid_pdf_url: worshipAidResult.pdfUrl || null,
        generation_error: [setlistResult.error, worshipAidResult.error].filter(Boolean).join("; ") || null,
        content_hash: newHash,
      })
      .eq("id", setlistId);
  } catch (err) {
    await supabase
      .from("setlists")
      .update({
        generation_status: "failed",
        generation_error: err instanceof Error ? err.message : "Unknown error",
        content_hash: newHash,
      })
      .eq("id", setlistId);
  }
}
