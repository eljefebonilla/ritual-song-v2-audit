import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeSeasonBoundaries,
  getSeasonForDate,
  computeGloria,
  computeAlleluia,
  CALENDAR_YEAR_CONFIGS,
  type SeasonBoundary,
} from "@/lib/liturgical-compute";

export async function POST() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Read app_settings for transfer toggles (reserved for future use)
  // const { data: settingsRows } = await supabase.from("app_settings").select("*");

  // Fetch all liturgical_days rows
  const { data: rows, error: fetchError } = await supabase
    .from("liturgical_days")
    .select("id, date, rank, celebration_name, ecclesiastical_province")
    .order("date");

  if (fetchError || !rows) {
    return NextResponse.json(
      { error: fetchError?.message || "Failed to fetch liturgical days" },
      { status: 500 }
    );
  }

  // Build season boundaries for each calendar year config
  const allBoundaries: { config: typeof CALENDAR_YEAR_CONFIGS[0]; boundaries: SeasonBoundary[] }[] = [];

  for (const config of CALENDAR_YEAR_CONFIGS) {
    const boundaries = computeSeasonBoundaries(
      config.firstAdvent,
      config.ashWednesday,
      config.easterSunday,
      config.pentecostSunday,
      config.nextFirstAdvent
    );

    // Fix Christmas season end — find Baptism of the Lord row
    const baptismRow = rows.find(
      (r) =>
        (r.celebration_name as string).includes("BAPTISM OF THE LORD") &&
        r.date > config.firstAdvent
    );
    if (baptismRow) {
      const christmasBoundary = boundaries.find((b) => b.season === "christmas");
      if (christmasBoundary) christmasBoundary.end = baptismRow.date;

      const ordPart1 = boundaries.find((b) => b.label === "Ordinary Time (Part 1)");
      if (ordPart1) {
        const d = new Date(baptismRow.date + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        ordPart1.start = d.toISOString().split("T")[0];
      }
    }

    allBoundaries.push({ config, boundaries });
  }

  // Recompute season, gloria, alleluia for each row
  const updates: { id: string; season: string; gloria: boolean; alleluia: boolean }[] = [];

  for (const row of rows) {
    // Find the matching config for this date
    const match = allBoundaries.find(
      ({ config }) => row.date >= config.firstAdvent && row.date < config.nextFirstAdvent
    );

    if (!match) continue;

    const { config, boundaries } = match;
    const season = getSeasonForDate(row.date, boundaries);
    const dayOfWeek = new Date(row.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }).toUpperCase().slice(0, 3);
    const gloria = computeGloria(row.rank, season, dayOfWeek);
    const alleluia = computeAlleluia(row.date, config.ashWednesday, config.holySaturday);

    updates.push({ id: row.id, season, gloria, alleluia });
  }

  // Batch upsert updates
  let updatedCount = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    // Use individual updates since we need to match by id
    for (const update of batch) {
      const { error } = await supabase
        .from("liturgical_days")
        .update({
          season: update.season,
          gloria: update.gloria,
          alleluia: update.alleluia,
        })
        .eq("id", update.id);

      if (!error) updatedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    updatedRows: updatedCount,
    totalRows: rows.length,
  });
}
