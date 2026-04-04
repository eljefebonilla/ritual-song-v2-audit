import { createAdminClient } from "./admin";

export interface ScriptureSongMapping {
  readingType: string;
  readingReference: string | null;
  songId: string;
  legacyId: string | null;
  songTitle: string;
  matchMethod: string | null;
}

/**
 * Look up NPM-sourced scripture song recommendations for a liturgical occasion.
 * Returns only rows where song_id is resolved (matched to our library).
 * Joins songs table to include legacy_id for correlation with in-memory library.
 */
export async function getScriptureSongsForOccasion(
  occasionId: string
): Promise<ScriptureSongMapping[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("scripture_song_mappings")
    .select("reading_type, reading_reference, song_id, song_title, match_method, songs!inner(legacy_id)")
    .eq("occasion_id", occasionId)
    .not("song_id", "is", null);

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const song = row.songs as { legacy_id: string } | null;
    return {
      readingType: row.reading_type as string,
      readingReference: (row.reading_reference as string) ?? null,
      songId: row.song_id as string,
      legacyId: song?.legacy_id ?? null,
      songTitle: row.song_title as string,
      matchMethod: (row.match_method as string) ?? null,
    };
  });
}
