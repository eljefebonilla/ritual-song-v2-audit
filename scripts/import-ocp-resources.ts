/**
 * Import OCP Fresh Resource Files into Supabase Storage + song_resources_v2.
 *
 * Pipeline:
 * 1. Load song-library.json for title matching
 * 2. Match OCP filenames to existing song IDs (tiered: exact → normalized → prefix)
 * 3. Create new song entries for unmatched OCP titles
 * 4. Rename files to Arielle's convention: [Song Name] - [Composer Surname] [TYPE].ext
 * 5. Upload to Supabase Storage bucket "song-resources"
 * 6. Create song_resources_v2 rows
 *
 * Usage:
 *   npx tsx scripts/import-ocp-resources.ts --dry-run    # preview matches, no uploads
 *   npx tsx scripts/import-ocp-resources.ts              # full import
 *   npx tsx scripts/import-ocp-resources.ts --zero-only  # just zero out resources (backup first)
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ───── CONFIGURATION ─────

const OCP_DIR = "/Users/jeffreybonilla/Desktop/OCP Fresh Resource Files";
const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");
const BACKUP_DIR = path.join(__dirname, "../backups");
const STORAGE_BUCKET = "song-resources";

// OCP folder → resource type + label suffix
// Ordered smallest-first so bulk throughput is high before hitting 7GB audio
const FOLDER_MAP: Record<string, { type: string; label: string; tag: string }> = {
  "Choral Cantor Sheet Music": { type: "sheet_music", label: "Choral/Cantor", tag: "CC" },
  "Instrumental Accompaniment": { type: "sheet_music", label: "Instrumental", tag: "INST" },
  "Guitar Accompaniment": { type: "sheet_music", label: "Guitar", tag: "GTR" },
  "Keyboard Accompaniment": { type: "sheet_music", label: "Keyboard", tag: "KBD" },
  "Song Lyrics": { type: "lyrics", label: "Lyrics", tag: "LYR" },
  "Congregational Sheet Music": { type: "sheet_music", label: "Congregational", tag: "CONG" },
  "Congregational Sheet Music GIF": { type: "sheet_music", label: "Congregational (GIF)", tag: "CONG" },
  "Audio Recordings": { type: "audio", label: "Audio Recording", tag: "AUDIO" },
};

// ───── TYPES ─────

interface LibrarySong {
  id: string;
  title: string;
  composer?: string;
  category?: string;
  resources?: unknown[];
  [key: string]: unknown;
}

interface MatchResult {
  songId: string;
  songTitle: string;
  composer: string;
  supabaseUuid: string | null;
  tier: string;
  isNew: boolean;
}

interface FileToImport {
  localPath: string;
  ocpTitle: string;
  folder: string;
  ext: string;
  match: MatchResult;
  storagePath: string;
  label: string;
  type: string;
  tag: string;
}

// ───── TITLE MATCHING ─────

function normalize(t: string): string {
  return t
    .toLowerCase()
    .replace(/[•–—]/g, " ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStrip(t: string): string {
  return normalize(t)
    .replace(/\([^)]*\)/g, "") // strip parentheticals
    .replace(/\s+/g, " ")
    .trim();
}

function buildMatchers(songs: LibrarySong[]) {
  const exact = new Map<string, LibrarySong>();
  const norm = new Map<string, LibrarySong>();
  const normStripped = new Map<string, LibrarySong>();
  const prefixMap = new Map<string, LibrarySong>();
  // For "starts with" matching: normalized library titles indexed for prefix search
  const allNormTitles: { norm: string; song: LibrarySong }[] = [];

  for (const s of songs) {
    // Exact
    if (!exact.has(s.title)) exact.set(s.title, s);

    // Normalized
    const n = normalize(s.title);
    if (!norm.has(n)) norm.set(n, s);
    allNormTitles.push({ norm: n, song: s });

    // Normalized with parentheticals stripped
    const ns = normalizeStrip(s.title);
    if (!normStripped.has(ns)) normStripped.set(ns, s);

    // First part before " / " or " - " (for dual-title songs)
    if (s.title.includes("/")) {
      const first = s.title.split("/")[0].trim();
      if (!prefixMap.has(first)) prefixMap.set(first, s);
      const nFirst = normalize(first);
      if (!prefixMap.has(nFirst)) prefixMap.set(nFirst, s);
    }
    if (s.title.includes(" - ")) {
      const first = s.title.split(" - ")[0].trim();
      if (!prefixMap.has(first)) prefixMap.set(first, s);
    }
  }

  return { exact, norm, normStripped, prefixMap, allNormTitles };
}

function matchTitle(
  ocpTitle: string,
  matchers: ReturnType<typeof buildMatchers>
): { song: LibrarySong; tier: string } | null {
  const { exact, norm, normStripped, prefixMap, allNormTitles } = matchers;

  // Tier 1: Exact
  if (exact.has(ocpTitle)) return { song: exact.get(ocpTitle)!, tier: "exact" };

  // Tier 2: Normalized
  const n = normalize(ocpTitle);
  if (norm.has(n)) return { song: norm.get(n)!, tier: "normalized" };

  // Tier 3: Normalized with parentheticals stripped
  const ns = normalizeStrip(ocpTitle);
  if (normStripped.has(ns)) return { song: normStripped.get(ns)!, tier: "norm-stripped" };

  // Tier 4: Prefix match (OCP title is first part of dual-title)
  if (prefixMap.has(ocpTitle)) return { song: prefixMap.get(ocpTitle)!, tier: "prefix" };
  if (prefixMap.has(n)) return { song: prefixMap.get(n)!, tier: "prefix-norm" };

  // Tier 5: Library title starts with OCP title (catches "A Mighty Fortress" → "A Mighty Fortress Is Our God")
  // Only match if OCP title is at least 4 words to avoid false positives
  if (n.split(" ").length >= 3) {
    const matches = allNormTitles.filter((t) => t.norm.startsWith(n + " "));
    if (matches.length === 1) {
      return { song: matches[0].song, tier: "starts-with" };
    }
  }

  return null;
}

// ───── NAMING CONVENTION ─────

function extractSurname(composer: string): string {
  if (!composer) return "";

  // Strip common patterns (word-bounded to avoid matching inside names like "Farrell")
  let c = composer
    .replace(/[•–—]/g, ",")
    .replace(/\s*\b(?:Arr\.?(?:anged)?)\b\s*(?:by\s*)?/gi, ",")
    .replace(/\s*\b(?:Adapted)\b\s*(?:by\s*)?/gi, ",")
    .split(",")[0] // take first composer only
    .trim();

  // Strip religious order suffixes
  c = c.replace(/\s*,?\s*(?:SJ|CSP|CSSP|OP|DC|OSB|OFM|SM|SS\.CC\.?)\s*$/i, "").trim();

  // Get last word as surname
  const parts = c.split(/\s+/);
  if (parts.length === 0) return "";
  return parts[parts.length - 1];
}

function sanitizeForStorage(str: string): string {
  return str
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function buildStoragePath(
  legacyId: string,
  title: string,
  composer: string,
  tag: string,
  ext: string,
  isSS: boolean
): string {
  const surname = extractSurname(composer);
  let namePart = title;
  if (surname) namePart += ` - ${surname}`;
  if (isSS) namePart += " SS";

  const safeName = sanitizeForStorage(namePart);
  const safeTag = tag;
  return `${legacyId}/${safeName}_${safeTag}${ext}`;
}

// ───── SLUG GENERATION ─────

function titleToSlug(title: string, composer?: string): string {
  let slug = title.toLowerCase();
  // Add composer to slug for uniqueness
  if (composer) {
    const surname = extractSurname(composer).toLowerCase();
    if (surname) slug += `--${surname}`;
  }
  return slug
    .replace(/[•–—]/g, "-")
    .replace(/['']/g, "")
    .replace(/[""]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

// ───── MIME TYPE ─────

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".pdf": "application/pdf",
    ".gif": "image/gif",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".txt": "text/plain",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

// ───── BACKUP ─────

async function backupExistingResources(songs: LibrarySong[]) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  // Backup JSON resources
  const jsonResources = songs
    .filter((s) => s.resources && (s.resources as unknown[]).length > 0)
    .map((s) => ({ id: s.id, title: s.title, resources: s.resources }));
  const jsonPath = path.join(BACKUP_DIR, `resources-json-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonResources, null, 2));
  console.log(`  JSON resources backed up: ${jsonPath} (${jsonResources.length} songs)`);

  // Backup DB resources
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("song_resources_v2")
      .select("*")
      .range(offset, offset + 999);
    if (error) {
      console.error("  Error fetching DB resources for backup:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  const dbPath = path.join(BACKUP_DIR, `resources-db-${timestamp}.json`);
  fs.writeFileSync(dbPath, JSON.stringify(allRows, null, 2));
  console.log(`  DB resources backed up: ${dbPath} (${allRows.length} rows)`);

  return { jsonPath, dbPath };
}

// ───── ZERO OUT ─────

async function zeroOutResources(songs: LibrarySong[]) {
  console.log("\n=== ZEROING OUT RESOURCES ===");

  // 1. Delete all song_resources_v2 rows
  console.log("  Deleting song_resources_v2 rows...");
  // Supabase doesn't support DELETE without a filter, so we use a broad filter
  const { error: deleteError, count } = await supabase
    .from("song_resources_v2")
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // matches all real rows
  if (deleteError) {
    console.error("  Error deleting resources:", deleteError.message);
    throw deleteError;
  }
  console.log(`  Deleted ${count} DB resource rows`);

  // 2. Empty storage bucket
  console.log("  Emptying song-resources bucket...");
  let totalRemoved = 0;
  // List and remove in batches (Supabase Storage list returns max 1000)
  while (true) {
    const { data: files, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list("", { limit: 1000 });
    if (listError) {
      console.error("  Error listing bucket:", listError.message);
      break;
    }
    if (!files || files.length === 0) break;

    // For each folder, list and delete files inside
    for (const item of files) {
      if (item.id === null) {
        // It's a folder, list contents
        const { data: subFiles } = await supabase.storage
          .from(STORAGE_BUCKET)
          .list(item.name, { limit: 1000 });
        if (subFiles && subFiles.length > 0) {
          const paths = subFiles.map((f) => `${item.name}/${f.name}`);
          const { error: removeError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove(paths);
          if (removeError) console.error(`  Error removing files in ${item.name}:`, removeError.message);
          else totalRemoved += paths.length;
        }
      } else {
        // It's a file at root level
        const { error: removeError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([item.name]);
        if (removeError) console.error(`  Error removing ${item.name}:`, removeError.message);
        else totalRemoved++;
      }
    }

    // Check if there are more
    const { data: remaining } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list("", { limit: 1 });
    if (!remaining || remaining.length === 0) break;
  }
  console.log(`  Removed ${totalRemoved} files from storage`);

  // 3. Strip resources from song-library.json
  console.log("  Stripping resources from song-library.json...");
  let strippedCount = 0;
  for (const song of songs) {
    if (song.resources && (song.resources as unknown[]).length > 0) {
      strippedCount++;
      song.resources = [];
    }
  }
  fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(songs, null, 2) + "\n");
  console.log(`  Stripped resources from ${strippedCount} songs in JSON`);
}

// ───── COLLECT FILES TO IMPORT ─────

function collectFiles(
  songs: LibrarySong[],
  matchers: ReturnType<typeof buildMatchers>,
  uuidMap: Map<string, string>
): { files: FileToImport[]; newSongs: LibrarySong[] } {
  const files: FileToImport[] = [];
  const newSongs: LibrarySong[] = [];
  const newSongsByTitle = new Map<string, LibrarySong>();
  const existingIds = new Set(songs.map((s) => s.id));

  for (const [folder, config] of Object.entries(FOLDER_MAP)) {
    const folderPath = path.join(OCP_DIR, folder);
    if (!fs.existsSync(folderPath)) continue;

    const dirFiles = fs.readdirSync(folderPath).filter((f) => {
      const full = path.join(folderPath, f);
      return fs.statSync(full).isFile() && !f.startsWith(".");
    });

    for (const fileName of dirFiles) {
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const isSS = baseName.endsWith(" (S&S)");
      const ocpTitle = baseName.replace(/ \(S&S\)$/, "");

      let match: MatchResult;

      const existing = matchTitle(ocpTitle, matchers);
      if (existing) {
        match = {
          songId: existing.song.id,
          songTitle: existing.song.title,
          composer: existing.song.composer || "",
          supabaseUuid: uuidMap.get(existing.song.id) || null,
          tier: existing.tier,
          isNew: false,
        };
      } else {
        // Create new song entry
        let newSong = newSongsByTitle.get(ocpTitle);
        if (!newSong) {
          const slug = titleToSlug(ocpTitle);
          // Ensure unique slug
          let uniqueSlug = slug;
          let counter = 2;
          while (existingIds.has(uniqueSlug) || newSongsByTitle.has(uniqueSlug)) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
          }
          existingIds.add(uniqueSlug);

          newSong = {
            id: uniqueSlug,
            title: ocpTitle,
            composer: "",
            category: "song",
            resources: [],
            functions: [],
            occasions: [],
            usageCount: 0,
          };
          newSongsByTitle.set(ocpTitle, newSong);
          newSongs.push(newSong);
        }

        match = {
          songId: newSong.id,
          songTitle: newSong.title,
          composer: "",
          supabaseUuid: null, // will be created
          tier: "new",
          isNew: true,
        };
      }

      const storagePath = buildStoragePath(
        match.songId,
        match.songTitle,
        match.composer,
        config.tag,
        ext,
        isSS
      );

      files.push({
        localPath: path.join(folderPath, fileName),
        ocpTitle,
        folder,
        ext,
        match,
        storagePath,
        label: isSS ? `${config.label} (S&S)` : config.label,
        type: config.type,
        tag: config.tag,
      });
    }
  }

  return { files, newSongs };
}

// ───── CREATE NEW SONGS IN SUPABASE ─────

async function createNewSongsInSupabase(
  newSongs: LibrarySong[]
): Promise<Map<string, string>> {
  const uuidMap = new Map<string, string>();
  if (newSongs.length === 0) return uuidMap;

  console.log(`\n  Creating ${newSongs.length} new songs in Supabase...`);

  // Batch insert in groups of 100
  for (let i = 0; i < newSongs.length; i += 100) {
    const batch = newSongs.slice(i, i + 100);
    const rows = batch.map((s) => ({
      legacy_id: s.id,
      title: s.title,
      composer: s.composer || null,
      category: "song",
    }));

    const { data, error } = await supabase
      .from("songs")
      .insert(rows)
      .select("id, legacy_id");

    if (error) {
      console.error(`  Error creating songs batch ${i}:`, error.message);
      continue;
    }

    for (const row of data || []) {
      uuidMap.set(row.legacy_id, row.id);
    }

    process.stdout.write(`  Created ${Math.min(i + 100, newSongs.length)}/${newSongs.length}\r`);
  }
  console.log();

  return uuidMap;
}

// ───── UPLOAD FILES (PARALLEL) ─────

const CONCURRENCY = 50; // parallel uploads

type DbRow = {
  song_id: string;
  type: string;
  label: string;
  url: string;
  storage_path: string;
  source: string;
  is_highlighted: boolean;
  tags: string[];
};

async function uploadSingleFile(
  f: FileToImport,
  uuidMap: Map<string, string>
): Promise<{ status: "uploaded" | "skipped" | "error"; row?: DbRow; error?: string }> {
  const uuid = f.match.supabaseUuid || uuidMap.get(f.match.songId);
  if (!uuid) {
    return { status: "error", error: `No UUID for ${f.match.songId}` };
  }

  const buffer = fs.readFileSync(f.localPath);
  const contentType = getMimeType(f.ext);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(f.storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    if (uploadError.message.includes("already exists")) {
      return { status: "skipped" };
    }
    return { status: "error", error: uploadError.message };
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(f.storagePath);

  return {
    status: "uploaded",
    row: {
      song_id: uuid,
      type: f.type,
      label: f.label,
      url: urlData.publicUrl,
      storage_path: f.storagePath,
      source: "ocp_bb",
      is_highlighted: false,
      tags: [f.tag],
    },
  };
}

async function uploadFiles(
  files: FileToImport[],
  uuidMap: Map<string, string>
) {
  console.log(`\n=== UPLOADING ${files.length} FILES (${CONCURRENCY} concurrent) ===`);

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;
  const allDbRows: DbRow[] = [];

  // Process in batches of CONCURRENCY
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((f) => uploadSingleFile(f, uuidMap))
    );

    for (const result of results) {
      processed++;
      if (result.status === "uploaded" && result.row) {
        uploaded++;
        allDbRows.push(result.row);
      } else if (result.status === "skipped") {
        skipped++;
      } else {
        errors++;
        if (result.error && errors <= 10) {
          console.error(`\n  Error: ${result.error}`);
        }
      }
    }

    // Insert DB rows in batches of 500
    if (allDbRows.length >= 500) {
      const dbBatch = allDbRows.splice(0, 500);
      const { error: insertError } = await supabase
        .from("song_resources_v2")
        .insert(dbBatch);
      if (insertError) {
        console.error(`\n  DB insert error: ${insertError.message}`);
      }
    }

    process.stdout.write(
      `  Progress: ${processed}/${files.length} (uploaded: ${uploaded}, skipped: ${skipped}, errors: ${errors})\r`
    );
  }

  // Insert remaining DB rows
  if (allDbRows.length > 0) {
    // Insert in chunks of 500 to avoid payload limits
    for (let i = 0; i < allDbRows.length; i += 500) {
      const chunk = allDbRows.slice(i, i + 500);
      const { error: insertError } = await supabase
        .from("song_resources_v2")
        .insert(chunk);
      if (insertError) {
        console.error(`\n  Final DB insert error: ${insertError.message}`);
      }
    }
  }

  console.log(
    `\n  Done: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors`
  );
}

// ───── MAIN ─────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isZeroOnly = args.includes("--zero-only");
  const isUploadOnly = args.includes("--upload-only"); // skip backup/zero (already done)

  const mode = isDryRun ? "DRY RUN" : isZeroOnly ? "ZERO ONLY" : isUploadOnly ? "UPLOAD ONLY" : "FULL IMPORT";
  console.log("=== OCP Resource Import ===");
  console.log(`Mode: ${mode}`);

  // Load song library
  const songs: LibrarySong[] = JSON.parse(
    fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
  );
  console.log(`Loaded ${songs.length} songs from song-library.json`);

  // Load UUID map from Supabase songs table
  console.log("Loading song UUIDs from Supabase...");
  const uuidMap = new Map<string, string>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id")
      .range(offset, offset + 999);
    if (error) {
      console.error("Error loading songs from DB:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.legacy_id) uuidMap.set(row.legacy_id, row.id);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`  ${uuidMap.size} songs found in Supabase`);

  // Build matchers
  const matchers = buildMatchers(songs);

  // Collect files
  const { files, newSongs } = collectFiles(songs, matchers, uuidMap);

  // Summary
  const matchedFiles = files.filter((f) => !f.match.isNew);
  const unmatchedFiles = files.filter((f) => f.match.isNew);
  const uniqueNewTitles = new Set(unmatchedFiles.map((f) => f.ocpTitle));

  console.log(`\n=== MATCHING SUMMARY ===`);
  console.log(`Total files: ${files.length}`);
  console.log(`Matched to existing songs: ${matchedFiles.length}`);
  console.log(`New songs to create: ${uniqueNewTitles.size}`);
  console.log(`Files for new songs: ${unmatchedFiles.length}`);

  // Show match tier breakdown
  const tierCounts = new Map<string, number>();
  for (const f of files) {
    const tier = f.match.tier;
    tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
  }
  console.log("\nMatch tiers:");
  for (const [tier, count] of [...tierCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${count}`);
  }

  // Show folder breakdown
  console.log("\nBy folder:");
  const folderCounts = new Map<string, { total: number; matched: number }>();
  for (const f of files) {
    const fc = folderCounts.get(f.folder) || { total: 0, matched: 0 };
    fc.total++;
    if (!f.match.isNew) fc.matched++;
    folderCounts.set(f.folder, fc);
  }
  for (const [folder, counts] of folderCounts) {
    console.log(`  ${folder}: ${counts.matched}/${counts.total} matched`);
  }

  if (isDryRun) {
    // Show sample of new songs
    console.log(`\nSample new songs (first 30):`);
    for (const s of newSongs.slice(0, 30)) {
      console.log(`  "${s.title}" → ${s.id}`);
    }

    // Show sample storage paths
    console.log(`\nSample storage paths (first 20):`);
    for (const f of files.slice(0, 20)) {
      console.log(`  ${f.storagePath}`);
    }
    console.log("\nDry run complete. Run without --dry-run to execute.");
    return;
  }

  if (!isUploadOnly) {
    // ─── BACKUP ───
    console.log("\n=== BACKUP ===");
    await backupExistingResources(songs);

    if (isZeroOnly) {
      await zeroOutResources(songs);
      console.log("\nZero-out complete. Resources cleared.");
      return;
    }

    // ─── ZERO OUT ───
    await zeroOutResources(songs);
  } else {
    console.log("\n  Skipping backup/zero (--upload-only mode)");
  }

  // ─── CREATE NEW SONGS ───
  // Check which new songs already exist in Supabase (from prior partial run)
  const existingNewInDb = new Set<string>();
  for (const s of newSongs) {
    if (uuidMap.has(s.id)) existingNewInDb.add(s.id);
  }
  const trulyNewSongs = newSongs.filter((s) => !existingNewInDb.has(s.id));

  // Add new songs to JSON (only if not already there)
  if (!isUploadOnly && newSongs.length > 0) {
    songs.push(...newSongs);
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(songs, null, 2) + "\n");
    console.log(`  Added ${newSongs.length} new songs to song-library.json`);
  }

  // Create truly new songs in Supabase
  if (trulyNewSongs.length > 0) {
    const newUuids = await createNewSongsInSupabase(trulyNewSongs);
    for (const [legacyId, uuid] of newUuids) {
      uuidMap.set(legacyId, uuid);
    }
  } else if (existingNewInDb.size > 0) {
    console.log(`  ${existingNewInDb.size} new songs already in Supabase (prior run)`);
  }

  // Update file match UUIDs for new songs
  for (const f of files) {
    if (f.match.isNew && !f.match.supabaseUuid) {
      f.match.supabaseUuid = uuidMap.get(f.match.songId) || null;
    }
  }

  // ─── UPLOAD ───
  await uploadFiles(files, uuidMap);

  // ─── VERIFY ───
  console.log("\n=== VERIFICATION ===");
  const { count: resourceCount } = await supabase
    .from("song_resources_v2")
    .select("*", { count: "exact", head: true });
  console.log(`  song_resources_v2 rows: ${resourceCount}`);

  console.log("\nImport complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
