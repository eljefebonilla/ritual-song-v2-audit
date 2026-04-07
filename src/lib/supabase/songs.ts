import { createAdminClient } from "./admin";
import type { LibrarySong, SongResource, MassSetting, SongRanking, CalendarDay } from "../types";

/**
 * Map a Supabase songs row (snake_case) back to LibrarySong (camelCase).
 */
function mapSongRow(row: Record<string, unknown>, resources: SongResource[] = []): LibrarySong {
  return {
    id: row.legacy_id as string,
    supabaseId: row.id as string,
    title: row.title as string,
    composer: (row.composer as string) || undefined,
    category: row.category as LibrarySong["category"],
    functions: (row.functions as string[]) || [],
    recordedKey: (row.recorded_key as string) || undefined,
    psalmNumber: (row.psalm_number as number) || undefined,
    massSettingId: (row.mass_setting_id as string) || undefined,
    catalogs: (row.catalogs as LibrarySong["catalogs"]) || {},
    credits: (row.credits as LibrarySong["credits"]) || {},
    tuneMeter: (row.tune_meter as LibrarySong["tuneMeter"]) || {},
    firstLine: (row.first_line as string) || undefined,
    refrainFirstLine: (row.refrain_first_line as string) || undefined,
    languages: (row.languages as string[]) || [],
    topics: (row.topics as string[]) || [],
    scriptureRefs: (row.scripture_refs as string[]) || [],
    liturgicalUse: (row.liturgical_use as string[]) || [],
    youtubeUrl: (row.youtube_url as string) || undefined,
    songForm: (row.song_form as LibrarySong["songForm"]) || undefined,
    resources,
    usageCount: (row.usage_count as number) || 0,
    occasions: (row.occasions as string[]) || [],
    isHiddenGlobal: (row.is_hidden_global as boolean) || false,
  };
}

function mapResourceRow(row: Record<string, unknown>): SongResource {
  return {
    id: row.id as string,
    type: row.type as SongResource["type"],
    label: (row.label as string) || "",
    url: (row.url as string) || undefined,
    filePath: (row.file_path as string) || undefined,
    storagePath: (row.storage_path as string) || undefined,
    value: (row.value as string) || undefined,
    source: (row.source as SongResource["source"]) || undefined,
    isHighlighted: (row.is_highlighted as boolean) || false,
    tags: (row.tags as string[]) || undefined,
    visibility: (row.visibility as "all" | "admin") || undefined,
  };
}

/**
 * Fetch all songs from Supabase with their resources.
 * Returns LibrarySong[] shaped exactly like the JSON format for backward compat.
 */
export async function getSongsFromSupabase(): Promise<LibrarySong[]> {
  const supabase = createAdminClient();

  // Fetch all songs (paginated — Supabase default limit is 1000)
  const allSongs: Record<string, unknown>[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .range(offset, offset + pageSize - 1)
      .order("title");

    if (error) {
      console.error("Error fetching songs:", error.message);
      break;
    }

    if (!data || data.length === 0) break;
    allSongs.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  // Fetch all resources (also paginated)
  const allResources: Record<string, unknown>[] = [];
  offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("song_resources_v2")
      .select("*")
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Error fetching resources:", error.message);
      break;
    }

    if (!data || data.length === 0) break;
    allResources.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  // Group resources by song UUID
  const resourcesBySongId = new Map<string, SongResource[]>();
  for (const r of allResources) {
    const songId = r.song_id as string;
    const existing = resourcesBySongId.get(songId) || [];
    existing.push(mapResourceRow(r));
    resourcesBySongId.set(songId, existing);
  }

  // Map songs with their resources
  return allSongs.map((row) => {
    const uuid = row.id as string;
    const resources = resourcesBySongId.get(uuid) || [];
    return mapSongRow(row, resources);
  });
}

/**
 * Fetch all songs from Supabase WITHOUT resources (lightweight listing).
 * Resources are loaded on-demand per song via getSongByIdFromSupabase().
 */
export async function getSongsLightweight(): Promise<LibrarySong[]> {
  const supabase = createAdminClient();

  const allSongs: Record<string, unknown>[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id, title, composer, category, functions, recorded_key, psalm_number, mass_setting_id, catalogs, credits, tune_meter, first_line, refrain_first_line, languages, topics, scripture_refs, liturgical_use, usage_count, occasions, is_hidden_global, youtube_url, song_form")
      .range(offset, offset + pageSize - 1)
      .order("title");

    if (error) {
      console.error("Error fetching songs:", error.message);
      break;
    }

    if (!data || data.length === 0) break;
    allSongs.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allSongs.map((row) => mapSongRow(row, []));
}

/**
 * Fetch a single song by legacy_id or UUID.
 */
export async function getSongByIdFromSupabase(id: string): Promise<LibrarySong | null> {
  const supabase = createAdminClient();

  // Try legacy_id first, then UUID
  let { data: songRow } = await supabase
    .from("songs")
    .select("*")
    .eq("legacy_id", id)
    .single();

  if (!songRow) {
    const result = await supabase
      .from("songs")
      .select("*")
      .eq("id", id)
      .single();
    songRow = result.data;
  }

  if (!songRow) return null;

  // Fetch resources
  const { data: resourceRows } = await supabase
    .from("song_resources_v2")
    .select("*")
    .eq("song_id", songRow.id);

  const resources = (resourceRows || []).map(mapResourceRow);
  return mapSongRow(songRow, resources);
}

/**
 * Fetch songs by category.
 */
export async function getSongsByCategoryFromSupabase(category: string): Promise<LibrarySong[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .eq("category", category)
    .order("title");

  if (error || !data) return [];

  // Fetch resources for these songs
  const songIds = data.map((s: Record<string, unknown>) => s.id as string);
  const { data: resourceRows } = await supabase
    .from("song_resources_v2")
    .select("*")
    .in("song_id", songIds);

  const resourcesBySongId = new Map<string, SongResource[]>();
  for (const r of (resourceRows || [])) {
    const songId = r.song_id as string;
    const existing = resourcesBySongId.get(songId) || [];
    existing.push(mapResourceRow(r));
    resourcesBySongId.set(songId, existing);
  }

  return data.map((row: Record<string, unknown>) => {
    const uuid = row.id as string;
    return mapSongRow(row, resourcesBySongId.get(uuid) || []);
  });
}

/**
 * Fetch all mass settings with their linked songs.
 */
export async function getMassSettingsFromSupabase(): Promise<MassSetting[]> {
  const supabase = createAdminClient();

  const { data: settings } = await supabase
    .from("mass_settings")
    .select("*")
    .order("name");

  if (!settings) return [];

  const { data: songs } = await supabase
    .from("songs")
    .select("*")
    .not("mass_setting_id", "is", null);

  const songsBySettingId = new Map<string, LibrarySong[]>();
  for (const s of (songs || [])) {
    const settingId = s.mass_setting_id as string;
    const existing = songsBySettingId.get(settingId) || [];
    existing.push(mapSongRow(s));
    songsBySettingId.set(settingId, existing);
  }

  return settings.map((s: Record<string, unknown>) => ({
    id: s.id as string,
    name: s.name as string,
    composer: (s.composer as string) || undefined,
    notes: (s.notes as string) || undefined,
    pieces: songsBySettingId.get(s.id as string) || [],
  }));
}

/**
 * Fetch a user's song rankings.
 */
export async function getSongRankings(userId: string): Promise<SongRanking[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("song_rankings")
    .select("song_id, user_id, ranking, notes")
    .eq("user_id", userId);

  return (data || []).map((r: Record<string, unknown>) => ({
    songId: r.song_id as string,
    userId: r.user_id as string,
    ranking: r.ranking as number,
    notes: (r.notes as string) || undefined,
  }));
}

/**
 * Fetch a user's hidden song IDs.
 */
export async function getSongVisibility(userId: string): Promise<Set<string>> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("song_visibility")
    .select("song_id")
    .eq("user_id", userId)
    .eq("is_hidden", true);

  return new Set((data || []).map((r: Record<string, unknown>) => r.song_id as string));
}

/**
 * Fetch calendar days for a date range.
 */
export async function getCalendarDays(startDate: string, endDate: string): Promise<CalendarDay[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("calendar_days")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    date: row.date as string,
    liturgicalDayName: (row.liturgical_day_name as string) || undefined,
    celebrationRank: (row.celebration_rank as string) || undefined,
    liturgicalColor: (row.liturgical_color as string) || undefined,
    season: (row.season as string) || undefined,
    ordoNotes: (row.ordo_notes as string) || undefined,
    isHolyDay: (row.is_holy_day as boolean) || false,
    isHoliday: (row.is_holiday as boolean) || false,
    holidayName: (row.holiday_name as string) || undefined,
    occasionId: (row.occasion_id as string) || undefined,
    isRecurring: (row.is_recurring as boolean) || false,
    recurrenceType: (row.recurrence_type as string) || undefined,
    customNotes: (row.custom_notes as string) || undefined,
  }));
}
