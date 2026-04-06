/**
 * Re-match unmatched rows in scripture_song_mappings against the songs table.
 * Uses improved normalization to find songs that exact-string matching missed.
 *
 * Expected yield (from analysis):
 *   468 case-insensitive exact
 *    33 NPM prefix of library title (min 8 chars)
 *    62 library prefix of NPM title (min 8 chars)
 *    ~? stripped match (no parens, no subtitles)
 *
 * Usage:
 *   npx tsx scripts/rematch-npm-scripture.ts             # dry-run
 *   npx tsx scripts/rematch-npm-scripture.ts --execute   # write to Supabase
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";

// ----- Config -----

const isDryRun = !process.argv.includes("--execute");
const BATCH_SIZE = 100;

// ----- Types -----

interface UnmatchedRow {
  id: string;
  song_title: string;
}

interface SongRow {
  id: string;
  legacy_id: string | null;
  title: string;
}

interface MatchResult {
  rowId: string;
  songTitle: string;
  matchedSongId: string;
  matchedTitle: string;
  method: "rematch_exact" | "rematch_prefix" | "rematch_fuzzy";
}

// ----- Normalization -----

/**
 * Full normalization pipeline:
 *   1. Lowercase
 *   2. Normalize smart quotes / apostrophes to ASCII
 *   3. Strip leading articles: "The ", "A ", "An ", "O "
 *   4. Strip parenthetical suffixes like "(Bolduc)" or "(MUELLER)"
 *   5. Strip content after " / " or " - " (bilingual / subtitle separators)
 *   6. Collapse whitespace
 */
function normalize(title: string): string {
  let t = title.toLowerCase();

  // Normalize curly quotes / apostrophes
  t = t
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');

  // Strip content after " / " or " - " (subtitle / bilingual separator)
  t = t.replace(/\s+[\/\-]\s+.*$/, "");

  // Strip trailing parenthetical suffix: (anything)
  t = t.replace(/\s*\(.*\)\s*$/, "").trim();

  // Strip leading articles
  t = t.replace(/^(the|a|an|o)\s+/, "");

  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

/**
 * Lighter normalization that only does case + quote folding,
 * used for the exact-match pass (preserves articles and subtitles).
 */
function normalizeCaseOnly(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ----- Index Building -----

interface TitleIndex {
  /** exact lowercase key -> song id */
  exact: Map<string, string>;
  /** fully normalized key -> song id */
  stripped: Map<string, string>;
  /** array of [normalized, songId, originalTitle] for prefix scan */
  entries: Array<[string, string, string]>;
}

function buildIndex(songs: SongRow[]): TitleIndex {
  const exact = new Map<string, string>();
  const stripped = new Map<string, string>();
  const entries: Array<[string, string, string]> = [];

  for (const song of songs) {
    const exactKey = normalizeCaseOnly(song.title);
    const strippedKey = normalize(song.title);

    // First write wins for duplicate titles
    if (!exact.has(exactKey)) exact.set(exactKey, song.id);
    if (!stripped.has(strippedKey)) stripped.set(strippedKey, song.id);

    entries.push([exactKey, song.id, song.title]);
  }

  return { exact, stripped, entries };
}

// ----- Matching -----

function matchTitle(
  npmTitle: string,
  index: TitleIndex
): Omit<MatchResult, "rowId" | "songTitle"> | null {
  const exactKey = normalizeCaseOnly(npmTitle);
  const strippedKey = normalize(npmTitle);

  // Pass 1: exact case-insensitive
  const exactId = index.exact.get(exactKey);
  if (exactId) {
    return { matchedSongId: exactId, matchedTitle: npmTitle, method: "rematch_exact" };
  }

  // Pass 2: prefix — NPM title is prefix of library title (min 8 chars)
  if (exactKey.length >= 8) {
    for (const [libKey, libId] of index.entries) {
      if (libKey.startsWith(exactKey) && libKey !== exactKey) {
        return { matchedSongId: libId, matchedTitle: libKey, method: "rematch_prefix" };
      }
    }
  }

  // Pass 3: reverse prefix — library title is prefix of NPM title (min 8 chars)
  for (const [libKey, libId] of index.entries) {
    if (
      libKey.length >= 8 &&
      exactKey.startsWith(libKey) &&
      libKey !== exactKey
    ) {
      return { matchedSongId: libId, matchedTitle: libKey, method: "rematch_prefix" };
    }
  }

  // Pass 4: stripped match (no parens, no subtitles, no leading articles)
  if (strippedKey.length >= 4) {
    const strippedId = index.stripped.get(strippedKey);
    if (strippedId) {
      return { matchedSongId: strippedId, matchedTitle: strippedKey, method: "rematch_fuzzy" };
    }
  }

  return null;
}

// ----- Supabase Helpers -----

async function loadUnmatched(
  supabase: ReturnType<typeof createClient>
): Promise<UnmatchedRow[]> {
  const rows: UnmatchedRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("scripture_song_mappings")
      .select("id, song_title")
      .is("song_id", null)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Loading unmatched rows: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function loadSongs(
  supabase: ReturnType<typeof createClient>
): Promise<SongRow[]> {
  const songs: SongRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id, title")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Loading songs: ${error.message}`);
    if (!data || data.length === 0) break;

    songs.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return songs;
}

async function applyUpdates(
  supabase: ReturnType<typeof createClient>,
  matches: MatchResult[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = matches.slice(i, i + BATCH_SIZE);

    // Supabase doesn't support batch updates with different values per row,
    // so we run them concurrently within the batch.
    const results = await Promise.all(
      batch.map(({ rowId, matchedSongId, method }) =>
        supabase
          .from("scripture_song_mappings")
          .update({ song_id: matchedSongId, match_method: method })
          .eq("id", rowId)
      )
    );

    for (const { error } of results) {
      if (error) {
        console.error(`  Update error: ${error.message}`);
        errors++;
      } else {
        updated++;
      }
    }

    if (i + BATCH_SIZE < matches.length) {
      process.stdout.write(
        `  ${updated} updated (${Math.round(((i + BATCH_SIZE) / matches.length) * 100)}%)...\r`
      );
    }
  }

  return { updated, errors };
}

// ----- Main -----

async function main() {
  console.log(isDryRun ? "=== DRY RUN ===" : "=== EXECUTING ===");
  console.log();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Load data
  console.log("Loading unmatched scripture_song_mappings rows...");
  const unmatched = await loadUnmatched(supabase);
  console.log(`  ${unmatched.length} unmatched rows`);

  console.log("Loading songs table...");
  const songs = await loadSongs(supabase);
  console.log(`  ${songs.length} songs loaded`);

  // 2. Build index
  console.log("\nBuilding title index...");
  const index = buildIndex(songs);
  console.log(`  ${index.exact.size} exact keys, ${index.stripped.size} stripped keys`);

  // 3. Match
  console.log("\nMatching...");
  const matches: MatchResult[] = [];
  const methodCounts: Record<string, number> = {
    rematch_exact: 0,
    rematch_prefix: 0,
    rematch_fuzzy: 0,
  };

  for (const row of unmatched) {
    const hit = matchTitle(row.song_title, index);
    if (hit) {
      matches.push({ rowId: row.id, songTitle: row.song_title, ...hit });
      methodCounts[hit.method]++;
    }
  }

  // 4. Report
  console.log("\n=== RESULTS ===");
  console.log(`Unmatched rows loaded:  ${unmatched.length}`);
  console.log(`Newly matched:          ${matches.length}`);
  console.log(`Still unmatched:        ${unmatched.length - matches.length}`);
  console.log();
  console.log("Match method distribution:");
  console.log(`  rematch_exact:  ${methodCounts.rematch_exact}`);
  console.log(`  rematch_prefix: ${methodCounts.rematch_prefix}`);
  console.log(`  rematch_fuzzy:  ${methodCounts.rematch_fuzzy}`);

  // 5. Sample
  if (matches.length > 0) {
    console.log("\nSample matches (up to 20):");
    const sample = matches.slice(0, 20);
    for (const m of sample) {
      const npmDisplay = m.songTitle.substring(0, 36).padEnd(38);
      const libDisplay = m.matchedTitle.substring(0, 36).padEnd(38);
      console.log(`  ${npmDisplay} -> ${libDisplay} [${m.method}]`);
    }
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] No data written. Use --execute to apply updates.");
    return;
  }

  // 6. Apply updates
  console.log(`\nApplying ${matches.length} updates in batches of ${BATCH_SIZE}...`);
  const { updated, errors } = await applyUpdates(supabase, matches);

  console.log(`\nUpdated:  ${updated}`);
  if (errors) console.log(`Errors:   ${errors}`);
  console.log("Done.");
}

main().catch(console.error);
