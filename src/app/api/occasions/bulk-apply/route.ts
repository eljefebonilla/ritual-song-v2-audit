import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOccasion, getAllOccasions } from "@/lib/data";

type CommunionEntry = { title: string; composer?: string; youtubeUrl?: string };

const communionIndex = (position: string): number | null => {
  if (position === "communion1") return 0;
  if (position === "communion2") return 1;
  if (position === "communion3") return 2;
  if (position === "communion4") return 3;
  return null;
};

const buildCommunionValue = (currentValue: unknown, idx: number, entry: CommunionEntry | null) => {
  const current: CommunionEntry[] = Array.isArray(currentValue) ? [...(currentValue as CommunionEntry[])] : [];
  while (current.length <= idx) current.push({ title: "" });
  if (entry) {
    current[idx] = entry;
  } else {
    current.splice(idx, 1);
  }
  while (current.length > 0 && !current[current.length - 1]?.title) current.pop();
  return current.length > 0 ? current : null;
};

/**
 * POST /api/occasions/bulk-apply
 * Apply a song change to matching occasions.
 *
 * Scopes:
 * - "season"     = same song, this season, this ensemble only
 * - "season-all" = same song, this season, ALL ensembles
 * - "all"        = same song, everywhere, ALL ensembles + update song library
 *
 * Body: { occasionId, position, title, composer, scope, ensembleId, youtubeUrl?, originalTitle? }
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { occasionId, position, title, composer, scope, ensembleId, youtubeUrl, originalTitle } = body;

  if (!occasionId || !position || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sourceOccasion = getOccasion(occasionId);
  if (!sourceOccasion) {
    return NextResponse.json({ error: "Occasion not found" }, { status: 404 });
  }

  const fieldMap: Record<string, string> = {
    psalm: "responsorialPsalm",
    massSetting: "eucharisticAcclamations",
    communion1: "communionSongs",
    communion2: "communionSongs",
    communion3: "communionSongs",
    communion4: "communionSongs",
  };
  const communionIdx = communionIndex(position);
  const isCommunionPosition = communionIdx !== null;
  const field = fieldMap[position] || position;

  const supabase = createAdminClient();
  let applied = 0;

  let newValue: Record<string, string | undefined>;
  if (position === "psalm" || position === "responsorialPsalm") {
    newValue = { psalm: title, setting: composer || undefined, youtubeUrl: youtubeUrl || undefined };
  } else if (position === "massSetting") {
    newValue = { massSettingName: title, composer: composer || undefined };
  } else {
    newValue = { title, composer: composer || undefined, youtubeUrl: youtubeUrl || undefined };
  }
  const communionEntry: CommunionEntry | null = isCommunionPosition
    ? { title, composer: composer || undefined, youtubeUrl: youtubeUrl || undefined }
    : null;

  const matchTitle = originalTitle || title;
  const titleField = (position === "psalm" || position === "responsorialPsalm") ? "psalm" :
                     position === "massSetting" ? "massSettingName" : "title";

  // Determine which ensembles to search
  const allEnsembles = scope === "season-all" || scope === "all";
  const ensembleFilter = allEnsembles ? undefined : ensembleId;

  // Find existing entries that match the song title
  let query = supabase
    .from("music_plan_edits")
    .select("occasion_id, ensemble_id, value")
    .eq("field", field);

  if (ensembleFilter) {
    query = query.eq("ensemble_id", ensembleFilter);
  }

  const { data: existingEdits } = await query;

  if (!existingEdits) {
    return NextResponse.json({ applied: 0, total: 0 });
  }

  // Filter by season if needed
  const seasonFilter = (scope === "season" || scope === "season-all");
  const seasonOccasionIds = seasonFilter
    ? new Set(getAllOccasions().filter(o => o.season === sourceOccasion.season).map(o => o.id))
    : null;

  // Collect matching entries
  const updates: { occasion_id: string; ensemble_id: string; currentValue: unknown }[] = [];
  for (const edit of existingEdits) {
    const val = edit.value;
    if (!val) continue;

    let existingTitle: string | undefined;
    if (isCommunionPosition && communionIdx !== null) {
      const songs = Array.isArray(val) ? (val as CommunionEntry[]) : [];
      existingTitle = songs[communionIdx]?.title;
    } else {
      existingTitle = (val as Record<string, string>)[titleField];
    }
    if (existingTitle !== matchTitle) continue;

    if (seasonOccasionIds && !seasonOccasionIds.has(edit.occasion_id)) continue;

    updates.push({ occasion_id: edit.occasion_id, ensemble_id: edit.ensemble_id, currentValue: val });
  }

  // Batch upsert
  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const rows = batch.map(u => ({
      occasion_id: u.occasion_id,
      ensemble_id: u.ensemble_id,
      field,
      value: isCommunionPosition && communionIdx !== null
        ? buildCommunionValue(u.currentValue, communionIdx, communionEntry)
        : newValue,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("music_plan_edits")
      .upsert(rows, { onConflict: "occasion_id,ensemble_id,field" });

    if (error) {
      console.error("Bulk apply batch error:", error.message);
    } else {
      applied += batch.length;
    }
  }

  // Update song library for "all" scope
  if (scope === "all" && youtubeUrl && title) {
    const { data: songs } = await supabase
      .from("songs")
      .select("id")
      .ilike("title", title)
      .limit(5);

    if (songs && songs.length > 0) {
      for (const song of songs) {
        await supabase
          .from("songs")
          .update({ youtube_url: youtubeUrl, youtube_url_source: "manual" })
          .eq("id", song.id);
      }
    }
  }

  return NextResponse.json({ applied, total: updates.length });
}
