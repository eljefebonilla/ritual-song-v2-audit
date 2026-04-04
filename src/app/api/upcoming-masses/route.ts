import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SetlistSongRow } from "@/lib/booking-types";
import { getMissingPositions } from "@/lib/generators/completeness";

/**
 * GET /api/upcoming-masses
 * Returns all upcoming mass events with optional setlist data and completeness info.
 * Query: ?from=2026-04-01&to=2026-06-01&ensemble=Generations
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const from = searchParams.get("from") || new Date().toISOString().split("T")[0];
  const to = searchParams.get("to");
  const ensemble = searchParams.get("ensemble");

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
    .order("event_date", { ascending: true })
    .order("start_time_12h", { ascending: true });

  if (to) query = query.lte("event_date", to);
  if (ensemble) query = query.eq("ensemble", ensemble);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with completeness info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (data || []).map((me: any) => {
    const setlist = Array.isArray(me.setlists) ? me.setlists[0] : me.setlists;
    const songs = (setlist?.songs || []) as SetlistSongRow[];
    const filledCount = songs.filter(
      (r) => r.songs.length > 0 && r.songs.some((s) => s.title.trim() !== "")
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
