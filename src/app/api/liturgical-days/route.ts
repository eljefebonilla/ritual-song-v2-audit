import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/liturgical-days — Fetch liturgical day data
 * Query params:
 *   ?date=YYYY-MM-DD         — single day
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD — date range
 *   ?season=advent            — filter by season
 *   ?rank=solemnity           — filter by rank
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const season = searchParams.get("season");
  const rank = searchParams.get("rank");

  // Single date query
  if (date) {
    const { data, error } = await supabase
      .from("liturgical_days")
      .select("*")
      .eq("date", date);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // Range query
  let query = supabase
    .from("liturgical_days")
    .select("*")
    .order("date", { ascending: true });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  if (season) query = query.eq("season", season);
  if (rank) query = query.eq("rank", rank);

  // Default limit to prevent huge responses
  if (!from && !to) {
    query = query.limit(90); // ~3 months
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
