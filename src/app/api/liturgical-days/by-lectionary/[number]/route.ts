import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/liturgical-days/by-lectionary/[number]
 * Returns all liturgical days that use a given lectionary number.
 * Useful for: "When else is this reading/psalm used?"
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;
  const lectNum = parseInt(number, 10);

  if (isNaN(lectNum)) {
    return NextResponse.json(
      { error: "Invalid lectionary number" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("liturgical_days")
    .select("date, celebration_name, rank, season, color_primary, lectionary_number")
    .eq("lectionary_number", lectNum)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
