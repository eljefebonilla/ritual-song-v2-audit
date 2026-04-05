import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SetlistSongRow } from "@/lib/booking-types";
import { getMissingPositions } from "@/lib/generators/completeness";
import { syncPlannerToSetlist } from "@/lib/sync-planner-setlist";

/**
 * GET /api/upcoming-masses
 * Returns all upcoming mass events with setlist data and completeness info.
 * Auto-syncs planner data to setlists for any mass that has planner data but no setlist.
 * Query: ?from=2026-04-01&to=2026-06-01&ensemble=Generations
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);

  const from = searchParams.get("from") || new Date().toISOString().split("T")[0];
  const to = searchParams.get("to");
  const ensemble = searchParams.get("ensemble");

  // First pass: fetch mass events with setlists
  let query = supabase
    .from("mass_events")
    .select(`
      id, title, event_date, start_time_12h, ensemble, liturgical_name, occasion_id,
      setlists (
        id, occasion_name, generation_status, generated_at,
        setlist_pdf_url, worship_aid_pdf_url, songs
      )
    `)
    .gte("event_date", from)
    .not("ensemble", "is", null)
    .order("event_date", { ascending: true })
    .order("start_time_12h", { ascending: true });

  if (to) query = query.lte("event_date", to);
  if (ensemble) query = query.eq("ensemble", ensemble);

  let { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Find masses without setlists OR with empty setlists that might have planner data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const needsSync = (data || []).filter((me: any) => {
    const setlist = Array.isArray(me.setlists) ? me.setlists[0] : me.setlists;
    if (!me.ensemble) return false;
    if (!setlist) return true;
    // Also sync if setlist exists but has no filled songs
    const songs = (setlist.songs || []) as SetlistSongRow[];
    const hasFilled = songs.some(
      (r: SetlistSongRow) => r.songs.length > 0 && r.songs.some((s) => s.title.trim() !== "")
    );
    return !hasFilled;
  });

  if (needsSync.length > 0) {
    // Get all planner occasion+ensemble pairs
    const { data: plannerPairs } = await admin
      .from("music_plan_edits")
      .select("occasion_id, ensemble_id");

    if (plannerPairs && plannerPairs.length > 0) {
      const uniquePairs = new Map<string, string>();
      for (const p of plannerPairs) {
        const key = `${p.occasion_id}::${p.ensemble_id}`;
        uniquePairs.set(key, p.occasion_id);
      }

      // For each mass without a setlist, try to match to planner data
      const synced = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const me of needsSync as any[]) {
        const ensembleId = (me.ensemble || "").toLowerCase();
        const titleTokens = (me.title || "")
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((t: string) => t.length > 1);

        if (titleTokens.length === 0) continue;

        // Find matching occasion
        for (const [key, occasionId] of uniquePairs) {
          if (!key.endsWith(`::${ensembleId}`)) continue;
          const occTokens = occasionId
            .replace(/-([abc])$/, "")
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((t: string) => t.length > 1);

          const match = titleTokens.every((tt: string) =>
            occTokens.some((ot: string) => ot.includes(tt) || tt.includes(ot))
          );

          if (match && !synced.has(key)) {
            synced.add(key);
            await syncPlannerToSetlist(occasionId, ensembleId);
            break;
          }
        }
      }

      // Re-fetch if we synced anything
      if (synced.size > 0) {
        let refetch = supabase
          .from("mass_events")
          .select(`
            id, title, event_date, start_time_12h, ensemble, liturgical_name, occasion_id,
            setlists (
              id, occasion_name, generation_status, generated_at,
              setlist_pdf_url, worship_aid_pdf_url, songs
            )
          `)
          .gte("event_date", from)
          .not("ensemble", "is", null)
          .order("event_date", { ascending: true })
          .order("start_time_12h", { ascending: true });

        if (to) refetch = refetch.lte("event_date", to);
        if (ensemble) refetch = refetch.eq("ensemble", ensemble);

        const { data: refreshed } = await refetch;
        if (refreshed) data = refreshed;
      }
    }
  }

  // Enrich with completeness info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (data || []).map((me: any) => {
    const setlist = Array.isArray(me.setlists) ? me.setlists[0] : me.setlists;
    const songs = (setlist?.songs || []) as SetlistSongRow[];
    const filledCount = songs.filter(
      (r: SetlistSongRow) => r.songs.length > 0 && r.songs.some((s) => s.title.trim() !== "")
    ).length;
    const missing = getMissingPositions(songs);

    return {
      id: me.id,
      title: me.title,
      event_date: me.event_date,
      start_time_12h: me.start_time_12h,
      ensemble: me.ensemble,
      liturgical_name: me.liturgical_name,
      occasion_id: me.occasion_id,
      setlist_id: setlist?.id || null,
      occasion_name: setlist?.occasion_name || null,
      generation_status: setlist?.generation_status || null,
      generated_at: setlist?.generated_at || null,
      setlist_pdf_url: setlist?.setlist_pdf_url || null,
      worship_aid_pdf_url: setlist?.worship_aid_pdf_url || null,
      filled_positions: filledCount,
      total_positions: songs.length || 16,
      missing_required: missing,
      is_complete: missing.length === 0 && filledCount > 0,
    };
  });

  return NextResponse.json(result);
}
