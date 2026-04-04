import { createAdminClient } from "./supabase/admin";
import type { SetlistSongRow, SetlistSongEntry } from "./booking-types";
import type { SongEntry } from "./types";
import { triggerGenerationIfReady } from "./generators/auto-trigger";

/**
 * Field name mapping: music_plan_edits field -> setlist position
 */
const FIELD_TO_POSITION: Record<string, { position: string; label: string }> = {
  prelude: { position: "prelude", label: "Prelude" },
  gathering: { position: "gathering", label: "Gathering" },
  penitentialAct: { position: "penitential_act", label: "Penitential Act" },
  gloria: { position: "gloria", label: "Gloria" },
  responsorialPsalm: { position: "psalm", label: "Responsorial Psalm" },
  gospelAcclamation: { position: "gospel_acclamation", label: "Gospel Acclamation" },
  offertory: { position: "offertory", label: "Offertory" },
  eucharisticAcclamations: { position: "holy", label: "Holy, Holy, Holy" },
  lordsPrayer: { position: "lords_prayer", label: "The Lord's Prayer" },
  fractionRite: { position: "fraction_rite", label: "Lamb of God" },
  communionSongs: { position: "communion_1", label: "Communion" },
  sending: { position: "sending", label: "Sending Forth" },
};

const STANDARD_POSITIONS = [
  "prelude", "gathering", "penitential_act", "gloria", "psalm",
  "gospel_acclamation", "offertory", "holy", "memorial", "amen",
  "lords_prayer", "fraction_rite", "communion_1", "communion_2",
  "communion_3", "sending",
];

const POSITION_LABELS: Record<string, string> = {
  prelude: "Prelude",
  gathering: "Gathering",
  penitential_act: "Penitential Act",
  gloria: "Gloria",
  psalm: "Responsorial Psalm",
  gospel_acclamation: "Gospel Acclamation",
  offertory: "Offertory",
  holy: "Holy, Holy, Holy",
  memorial: "Memorial Acclamation",
  amen: "Great Amen",
  lords_prayer: "The Lord's Prayer",
  fraction_rite: "Lamb of God",
  communion_1: "Communion",
  communion_2: "Communion 2",
  communion_3: "Communion 3",
  sending: "Sending Forth",
};

function toSetlistEntry(value: unknown): SetlistSongEntry[] {
  if (!value) return [];
  const v = value as SongEntry;
  if (!v.title) return [];
  return [{ title: v.title, composer: v.composer }];
}

/**
 * Convert music_plan_edits rows into SetlistSongRow[].
 */
function planEditsToSongRows(
  edits: { field: string; value: unknown }[]
): SetlistSongRow[] {
  const filled = new Map<string, SetlistSongRow>();

  for (const edit of edits) {
    const mapping = FIELD_TO_POSITION[edit.field];
    if (!mapping) continue;

    if (edit.field === "responsorialPsalm") {
      const ps = edit.value as { psalm?: string; setting?: string } | null;
      if (ps?.psalm) {
        filled.set("psalm", {
          position: "psalm",
          label: "Responsorial Psalm",
          songs: [{ title: ps.psalm, composer: ps.setting }],
        });
      }
    } else if (edit.field === "eucharisticAcclamations") {
      const ea = edit.value as { massSettingName?: string; composer?: string } | null;
      if (ea?.massSettingName) {
        const entry: SetlistSongEntry = { title: ea.massSettingName, composer: ea.composer };
        filled.set("holy", { position: "holy", label: "Holy, Holy, Holy", songs: [entry] });
        filled.set("memorial", { position: "memorial", label: "Memorial Acclamation", songs: [entry] });
        filled.set("amen", { position: "amen", label: "Great Amen", songs: [entry] });
      }
    } else if (edit.field === "communionSongs") {
      const songs = (edit.value || []) as SongEntry[];
      for (let i = 0; i < Math.min(songs.length, 3); i++) {
        const pos = `communion_${i + 1}`;
        filled.set(pos, {
          position: pos,
          label: i === 0 ? "Communion" : `Communion ${i + 1}`,
          songs: toSetlistEntry(songs[i]),
        });
      }
    } else {
      filled.set(mapping.position, {
        position: mapping.position,
        label: mapping.label,
        songs: toSetlistEntry(edit.value),
      });
    }
  }

  // Build full list with empty positions for anything not filled
  return STANDARD_POSITIONS.map(
    (pos) =>
      filled.get(pos) || {
        position: pos,
        label: POSITION_LABELS[pos] || pos,
        songs: [],
      }
  );
}

/**
 * Syncs planner data to setlists for all mass events matching an occasion + ensemble.
 * Called fire-and-forget from the music-plan PUT route.
 */
export async function syncPlannerToSetlist(
  occasionId: string,
  ensembleId: string
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Get all plan edits for this occasion+ensemble
  const { data: edits } = await supabase
    .from("music_plan_edits")
    .select("field, value")
    .eq("occasion_id", occasionId)
    .eq("ensemble_id", ensembleId);

  if (!edits || edits.length === 0) return;

  const songRows = planEditsToSongRows(edits);

  // 2. Find mass events matching this occasion + ensemble
  //    occasion_id on mass_events may be null — match by title pattern or occasion_id
  const ensembleName = ensembleId.charAt(0).toUpperCase() + ensembleId.slice(1);

  const { data: massEvents } = await supabase
    .from("mass_events")
    .select("id, occasion_id, title")
    .eq("ensemble", ensembleName);

  if (!massEvents || massEvents.length === 0) return;

  // Match by occasion_id if set, or by title pattern
  const occasionCode = occasionId.replace(/-([abc])$/, "").replace(/-/g, "");
  const matching = massEvents.filter((me) => {
    if (me.occasion_id === occasionId) return true;
    // Fuzzy match: "easter-02-divine-mercy-a" -> title contains "02Easter"
    const titleNorm = (me.title || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const codeNorm = occasionCode.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    return titleNorm.includes(codeNorm) || codeNorm.includes(titleNorm);
  });

  if (matching.length === 0) return;

  // 3. Upsert setlists
  for (const me of matching) {
    const { data: existing } = await supabase
      .from("setlists")
      .select("id")
      .eq("mass_event_id", me.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("setlists")
        .update({
          songs: songRows,
          occasion_name: null,
          occasion_id: occasionId,
          updated_at: new Date().toISOString(),
          generation_status: "outdated",
        })
        .eq("id", existing.id);
      triggerGenerationIfReady(existing.id, songRows).catch(() => {});
    } else {
      const { data: created } = await supabase
        .from("setlists")
        .insert({
          mass_event_id: me.id,
          occasion_id: occasionId,
          songs: songRows,
          personnel: [],
          version: 1,
        })
        .select("id")
        .single();
      if (created) {
        triggerGenerationIfReady(created.id, songRows).catch(() => {});
      }
    }
  }
}
