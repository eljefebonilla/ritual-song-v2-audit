import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/liturgical-days/today — Today's liturgical day
 * Returns the liturgical day data for the current date.
 */
export async function GET() {
  const supabase = createAdminClient();

  // Use Pacific time for St. Monica (Los Angeles)
  const now = new Date();
  const pacificDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"

  const { data, error } = await supabase
    .from("liturgical_days")
    .select("*")
    .eq("date", pacificDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "No liturgical data for today", date: pacificDate },
      { status: 404 }
    );
  }

  // Return the primary entry (universal, not province-specific)
  const primary = data.find(
    (d: Record<string, unknown>) => d.ecclesiastical_province === "__universal__"
  ) || data[0];

  return NextResponse.json({
    ...primary,
    allEntries: data.length > 1 ? data : undefined,
  });
}
