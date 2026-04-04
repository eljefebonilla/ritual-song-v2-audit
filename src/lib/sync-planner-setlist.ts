import { createAdminClient } from "./supabase/admin";
import type { SetlistSongRow, SetlistSongEntry } from "./booking-types";
import type { SongEntry, MusicPlan } from "./types";
import { getOccasion } from "./data";
import { bootstrapSongsFromPlan } from "./setlist-utils";
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

function toSetlistEntry(value: unknown): SetlistSongEntry[] {
  if (!value) return [];
  const v = value as SongEntry;
  if (!v.title) return [];
  return [{ title: v.title, composer: v.composer }];
}

/**
 * Apply DB overrides on top of bootstrapped song rows.
 * Overrides replace matching positions entirely.
 */
function applyOverrides(
  baseRows: SetlistSongRow[],
  edits: { field: string; value: unknown }[]
): SetlistSongRow[] {
  const overrides = new Map<string, SetlistSongRow>();

  for (const edit of edits) {
    const mapping = FIELD_TO_POSITION[edit.field];
    if (!mapping) continue;

    if (edit.field === "responsorialPsalm") {
      const ps = edit.value as { psalm?: string; setting?: string } | null;
      if (ps?.psalm) {
        overrides.set("psalm", {
          position: "psalm",
          label: "Responsorial Psalm",
          songs: [{ title: ps.psalm, composer: ps.setting }],
        });
      }
    } else if (edit.field === "eucharisticAcclamations") {
      const ea = edit.value as { massSettingName?: string; composer?: string } | null;
      if (ea?.massSettingName) {
        const entry: SetlistSongEntry = { title: ea.massSettingName, composer: ea.composer };
        overrides.set("holy", { position: "holy", label: "Holy, Holy, Holy", songs: [entry] });
        overrides.set("memorial", { position: "memorial", label: "Memorial Acclamation", songs: [entry] });
        overrides.set("amen", { position: "amen", label: "Great Amen", songs: [entry] });
      }
    } else if (edit.field === "communionSongs") {
      const songs = (edit.value || []) as SongEntry[];
      for (let i = 0; i < Math.min(songs.length, 3); i++) {
        const pos = `communion_${i + 1}`;
        overrides.set(pos, {
          position: pos,
          label: i === 0 ? "Communion" : `Communion ${i + 1}`,
          songs: toSetlistEntry(songs[i]),
        });
      }
    } else {
      overrides.set(mapping.position, {
        position: mapping.position,
        label: mapping.label,
        songs: toSetlistEntry(edit.value),
      });
    }
  }

  // Merge: override replaces base for matching positions
  return baseRows.map((row) => overrides.get(row.position) || row);
}

/**
 * Syncs planner data to setlists for all mass events matching an occasion + ensemble.
 * Merges the static occasion JSON base plan with DB overrides from music_plan_edits.
 * Called from the music-plan PUT route and the upcoming-masses API.
 */
export async function syncPlannerToSetlist(
  occasionId: string,
  ensembleId: string
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Load base plan from static occasion JSON
  const occasion = getOccasion(occasionId);
  const basePlan: MusicPlan | null = occasion
    ? occasion.musicPlans.find(
        (p) => (p.ensembleId || "").toLowerCase() === ensembleId.toLowerCase()
      ) || null
    : null;

  // Bootstrap from the base plan (gives us all positions with base songs)
  const baseRows = bootstrapSongsFromPlan(basePlan);

  // 2. Get DB overrides
  const { data: edits } = await supabase
    .from("music_plan_edits")
    .select("field, value")
    .eq("occasion_id", occasionId)
    .eq("ensemble_id", ensembleId);

  // 3. Merge: base plan + DB overrides
  const songRows = edits && edits.length > 0
    ? applyOverrides(baseRows, edits)
    : baseRows;

  // Skip if nothing to sync (no base plan and no overrides)
  const hasSongs = songRows.some(
    (r) => r.songs.length > 0 && r.songs.some((s) => s.title.trim() !== "")
  );
  if (!hasSongs) return;

  // 4. Find mass events matching this occasion + ensemble
  const ensembleName = ensembleId.charAt(0).toUpperCase() + ensembleId.slice(1);

  const { data: massEvents } = await supabase
    .from("mass_events")
    .select("id, occasion_id, title")
    .eq("ensemble", ensembleName);

  if (!massEvents || massEvents.length === 0) return;

  // Match by occasion_id if set, or by token-based fuzzy match
  const occTokens = occasionId
    .replace(/-([abc])$/, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t: string) => t.length > 1);

  const matching = massEvents.filter((me) => {
    if (me.occasion_id === occasionId) return true;
    const titleTokens = (me.title || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t: string) => t.length > 1);
    return titleTokens.every((tt: string) =>
      occTokens.some((ot: string) => ot.includes(tt) || tt.includes(ot))
    );
  });

  if (matching.length === 0) return;

  // 5. Upsert setlists
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
