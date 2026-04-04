import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/generate/occasion-info?occasionId=easter-02-divine-mercy-a
 *
 * Finds the most recent mass event for an occasion and returns
 * generation-related info: mass event ID, setlist ID, parish ID,
 * and any existing PDF URLs.
 */
export async function GET(request: NextRequest) {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const occasionId = request.nextUrl.searchParams.get("occasionId");
  if (!occasionId) {
    return NextResponse.json({ error: "occasionId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get user's parish
  const { data: profile } = await supabase
    .from("profiles")
    .select("parish_id")
    .eq("id", user.id)
    .single();

  const parishId = profile?.parish_id || null;

  // Find the most recent mass event for this occasion
  const { data: massEvents } = await supabase
    .from("mass_events")
    .select("id, event_date, ensemble")
    .eq("occasion_id", occasionId)
    .order("event_date", { ascending: false })
    .limit(1);

  const massEvent = massEvents?.[0];
  if (!massEvent) {
    return NextResponse.json({
      error: "No mass event found for this occasion",
      massEventId: null,
      parishId,
    });
  }

  // Check for existing setlist
  const { data: setlist } = await supabase
    .from("setlists")
    .select("id, generation_status, setlist_pdf_url, worship_aid_pdf_url")
    .eq("mass_event_id", massEvent.id)
    .maybeSingle();

  return NextResponse.json({
    massEventId: massEvent.id,
    setlistId: setlist?.id || null,
    parishId,
    generationStatus: setlist?.generation_status || null,
    setlistPdfUrl: setlist?.setlist_pdf_url || null,
    worshipAidPdfUrl: setlist?.worship_aid_pdf_url || null,
  });
}
