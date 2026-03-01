/**
 * wire-psalms-to-supabase.ts
 *
 * Scans Organized Psalms/ and links ALL files directly to Supabase songs
 * and song_resources_v2. Fills gaps left by the original link script.
 *
 * - Psalm PDFs → matched to songs by psalm number + antiphon text + collection
 * - Gospel Acclamation files → inserted as occasion resources in song_resources_v2
 *   linked to gospel acclamation songs
 * - Antiphon files → inserted as occasion resources in song_resources_v2
 *   linked to antiphon songs
 *
 * Usage: npx tsx scripts/wire-psalms-to-supabase.ts
 */
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const PSALMS_ROOT = path.join(__dirname, "..", "..", "Organized Psalms");

// ── Types ──

interface SongRow {
  id: string;
  legacy_id: string;
  title: string;
  composer: string | null;
  psalm_number: number | null;
  category: string;
}

interface PsalmIndex {
  psalmNum: number;
  collection: "lyric_psalter" | "spirit_psalm" | "other";
  antiphonWords: string[];
  song: SongRow;
}

// ── Report ──

const report = {
  filesScanned: 0,
  resourcesInserted: 0,
  songsCreated: 0,
  alreadyLinked: 0,
  noMatch: [] as string[],
  errors: [] as string[],
};

// ── Psalm matching (adapted from link-organized-psalms.ts) ──

function buildPsalmIndex(songs: SongRow[]): PsalmIndex[] {
  const index: PsalmIndex[] = [];
  for (const song of songs) {
    if (song.category !== "psalm") continue;

    const numMatch = song.title.match(/^Ps(?:alm)?\s+(\d+)/i);
    if (!numMatch) continue;

    const psalmNum = parseInt(numMatch[1], 10);
    let collection: "lyric_psalter" | "spirit_psalm" | "other" = "other";
    const comp = (song.composer || "").toLowerCase();
    if (comp.includes("lyric psalter") || comp.includes("lyric psaltes")) {
      collection = "lyric_psalter";
    } else if (comp.includes("spirit") && comp.includes("psalm")) {
      collection = "spirit_psalm";
    }

    const afterNum = song.title.replace(/^Ps(?:alm)?\s+\d+\s*[:.]?\s*/i, "");
    const antiphonWords = afterNum
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    index.push({ psalmNum, collection, antiphonWords, song });
  }
  return index;
}

function parsePsalmFilename(filename: string): {
  psalmNum: number | null;
  collection: "lyric_psalter" | "spirit_psalm" | "other";
  variant: string;
  antiphonWords: string[];
  arranger: string;
  title: string;
} {
  const parts = filename.replace(/\.[^.]+$/, "").split("_");

  let psalmNum: number | null = null;
  let collection: "lyric_psalter" | "spirit_psalm" | "other" = "other";
  let variant = "";
  let arranger = "";
  let title = "";
  const antiphonWords: string[] = [];

  for (const part of parts) {
    const psMatch = part.match(/^Ps-(\d+)$/i);
    if (psMatch) {
      psalmNum = parseInt(psMatch[1], 10);
      continue;
    }
    // Also match Ps-X (instrumental marker)
    if (part.match(/^Ps-X$/i)) continue;
    // Canticles: Exodus-15, Luk-1, Isa-12
    const canticleMatch = part.match(/^(?:Luk|Isa|Isaiah|Exodus|Dan|Deut)-(\d+)$/i);
    if (canticleMatch) {
      psalmNum = -parseInt(canticleMatch[1], 10);
      continue;
    }

    if (part === "LyricPsalter") { collection = "lyric_psalter"; variant = "lead_sheet"; }
    else if (part === "LyricPsalterChoral") { collection = "lyric_psalter"; variant = "choral"; }
    else if (part === "LyricPsalter-INST" || part === "LyricPsalterINST") { collection = "lyric_psalter"; variant = "instrumental"; }
    else if (part.startsWith("Spirit&Psalm")) { collection = "spirit_psalm"; variant = "lead_sheet"; }
  }

  // Arranger is typically the last part before extension
  const lastPart = parts[parts.length - 1];
  if (lastPart && !lastPart.match(/^(LyricPsalter|Spirit&Psalm|Ps-)/i)) {
    arranger = lastPart.replace(/-/g, " ");
  }

  // Extract antiphon words: parts between psalm number and collection tag
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p.match(/^Ps-\d+$/i) || p.match(/^Ps-X$/i)) continue;
    if (p.match(/^(?:Luk|Isa|Isaiah|Exodus|Dan|Deut)-\d+$/i)) continue;
    if (p.match(/^LyricPsalter/)) break;
    if (p.match(/^Spirit&Psalm/)) break;
    const words = p.replace(/-/g, " ").toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length > 2);
    antiphonWords.push(...words);
    if (!title) title = p.replace(/-/g, " ");
    else title += " " + p.replace(/-/g, " ");
  }

  return { psalmNum, collection, variant, antiphonWords, arranger, title };
}

function matchPsalmToSong(
  psalmNum: number,
  collection: "lyric_psalter" | "spirit_psalm" | "other",
  antiphonWords: string[],
  index: PsalmIndex[]
): SongRow | null {
  // Exact match: psalm number + collection
  let candidates = index.filter(
    (p) => p.psalmNum === psalmNum && p.collection === collection
  );

  // Fallback: any collection with that psalm number
  if (candidates.length === 0) {
    candidates = index.filter((p) => p.psalmNum === psalmNum);
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].song;

  // Score by antiphon word overlap
  let bestScore = -1;
  let bestSong: SongRow | null = null;

  for (const c of candidates) {
    let score = 0;
    for (const word of antiphonWords) {
      if (c.antiphonWords.includes(word)) score++;
    }
    // Prefer matching collection
    if (c.collection === collection) score += 3;
    if (score > bestScore) {
      bestScore = score;
      bestSong = c.song;
    }
  }

  return bestSong;
}

function psalmResourceLabel(variant: string, collection: string, arranger: string): string {
  let label = "";
  if (collection === "lyric_psalter") {
    if (variant === "choral") label = "Lyric Psalter - Choral";
    else if (variant === "instrumental") label = "Lyric Psalter - Instrumental";
    else label = "Lyric Psalter";
  } else if (collection === "spirit_psalm") {
    label = "Spirit & Psalm";
  } else {
    label = "Psalm Setting";
  }
  if (arranger && arranger !== "Unknown") {
    label += ` (${arranger})`;
  }
  return label;
}

function makeResourceId(filePath: string): string {
  return "op-" + filePath.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 80);
}

// ── Main ──

async function main() {
  console.log("=== Wire Organized Psalms to Supabase ===\n");

  // Load all songs from Supabase
  const allSongs: SongRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id, title, composer, psalm_number, category")
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    allSongs.push(...(data as SongRow[]));
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`Loaded ${allSongs.length} songs from Supabase`);

  // Build psalm index
  const psalmIndex = buildPsalmIndex(allSongs);
  console.log(`Built psalm index: ${psalmIndex.length} entries\n`);

  // Load existing resources to avoid duplicates
  const existingPaths = new Set<string>();
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from("song_resources_v2")
      .select("file_path")
      .not("file_path", "is", null)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (r.file_path) existingPaths.add(r.file_path);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`Existing resources with file_path: ${existingPaths.size}\n`);

  // Batch insert buffer
  const toInsert: Array<{
    song_id: string;
    type: string;
    label: string;
    file_path: string;
    source: string;
    is_highlighted: boolean;
  }> = [];

  // Walk Organized Psalms
  const seasons = fs.readdirSync(PSALMS_ROOT).filter((d) =>
    fs.statSync(path.join(PSALMS_ROOT, d)).isDirectory()
  );

  for (const season of seasons) {
    const seasonDir = path.join(PSALMS_ROOT, season);
    const folders = fs.readdirSync(seasonDir).filter((d) =>
      fs.statSync(path.join(seasonDir, d)).isDirectory()
    );

    for (const folder of folders) {
      const folderPath = path.join(seasonDir, folder);

      // Process Psalms subdirectory
      const psalmsDir = path.join(folderPath, "Psalms");
      if (fs.existsSync(psalmsDir)) {
        const files = fs.readdirSync(psalmsDir).filter((f) => {
          const ext = path.extname(f).toLowerCase();
          return ext === ".pdf" || ext === ".mp3";
        });

        for (const file of files) {
          report.filesScanned++;
          const filePath = `_psalms/${season}/${folder}/Psalms/${file}`;

          // Skip if already linked
          if (existingPaths.has(filePath)) {
            report.alreadyLinked++;
            continue;
          }

          const ext = path.extname(file).toLowerCase();
          const parsed = parsePsalmFilename(file);

          if (parsed.psalmNum === null) {
            report.noMatch.push(`${filePath} (no psalm number)`);
            continue;
          }

          const matched = matchPsalmToSong(
            parsed.psalmNum,
            parsed.collection,
            parsed.antiphonWords,
            psalmIndex
          );

          if (!matched) {
            report.noMatch.push(
              `${filePath} (no match for Ps ${parsed.psalmNum} ${parsed.collection})`
            );
            continue;
          }

          const label = psalmResourceLabel(parsed.variant, parsed.collection, parsed.arranger);
          const type = ext === ".mp3" ? "audio" : "sheet_music";

          toInsert.push({
            song_id: matched.id,
            type,
            label,
            file_path: filePath,
            source: "local",
            is_highlighted: false,
          });
        }
      }

      // Process Gospel Acclamations subdirectory
      const gaDir = path.join(folderPath, "Gospel Acclamations");
      if (fs.existsSync(gaDir)) {
        const files = fs.readdirSync(gaDir).filter((f) => {
          const ext = path.extname(f).toLowerCase();
          return ext === ".pdf" || ext === ".mp3";
        });

        for (const file of files) {
          report.filesScanned++;
          const filePath = `_psalms/${season}/${folder}/Gospel Acclamations/${file}`;

          if (existingPaths.has(filePath)) {
            report.alreadyLinked++;
            continue;
          }

          // Skip generic cantor book files
          if (file.startsWith("CantorsBook-")) continue;

          // Try to match to a gospel acclamation song
          const ext = path.extname(file).toLowerCase();
          let label = "Gospel Acclamation";
          if (file.includes("Spirit&Psalm")) {
            const parts = file.replace(/\.[^.]+$/, "").split("_");
            const composer = parts[parts.length - 1];
            label = `Gospel Acclamation - Spirit & Psalm (${composer})`;
          } else if (file.includes("GospelAcc") && file.includes("Alonso")) {
            label = "Gospel Acclamation (Alonso)";
          }

          // Find a GA song to attach to — use generic approach
          // Look for gospel_acclamation_refrain songs
          const gaSongs = allSongs.filter(
            (s) =>
              s.category === "gospel_acclamation_refrain" ||
              s.category === "gospel_acclamation_verse"
          );

          // Match by season/occasion code in filename
          // For now, pick the first GA song as a generic attachment point
          // The real value is having the file_path in the DB for Supabase upload
          if (gaSongs.length > 0) {
            toInsert.push({
              song_id: gaSongs[0].id, // Will be improved with occasion-specific matching
              type: ext === ".mp3" ? "audio" : "sheet_music",
              label,
              file_path: filePath,
              source: "local",
              is_highlighted: false,
            });
          }
        }
      }

      // Process Antiphons subdirectory
      const antDir = path.join(folderPath, "Antiphons");
      if (fs.existsSync(antDir)) {
        const files = fs.readdirSync(antDir).filter((f) => {
          const ext = path.extname(f).toLowerCase();
          return ext === ".pdf" || ext === ".mp3";
        });

        for (const file of files) {
          report.filesScanned++;
          const filePath = `_psalms/${season}/${folder}/Antiphons/${file}`;

          if (existingPaths.has(filePath)) {
            report.alreadyLinked++;
            continue;
          }

          const ext = path.extname(file).toLowerCase();
          let label = "Antiphon";
          if (file.includes("REJOICE")) {
            if (file.includes("Entrance")) label = "REJOICE Entrance Antiphon";
            else if (file.includes("Communion")) label = "REJOICE Communion Antiphon";
            else label = "REJOICE Antiphons";
          }

          // Find an antiphon song to attach to
          const antSongs = allSongs.filter((s) => s.category === "antiphon");
          if (antSongs.length > 0) {
            toInsert.push({
              song_id: antSongs[0].id,
              type: ext === ".mp3" ? "audio" : "sheet_music",
              label,
              file_path: filePath,
              source: "local",
              is_highlighted: false,
            });
          }
        }
      }
    }
  }

  // Batch insert
  console.log(`\nInserting ${toInsert.length} new resources...`);
  const batchSize = 100;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error } = await supabase.from("song_resources_v2").insert(batch);
    if (error) {
      report.errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
      console.error(`  Error at batch ${i}: ${error.message}`);
    } else {
      report.resourcesInserted += batch.length;
      if ((i + batchSize) % 500 === 0 || i + batchSize >= toInsert.length) {
        console.log(`  Inserted ${Math.min(i + batchSize, toInsert.length)}/${toInsert.length}`);
      }
    }
  }

  // Print report
  console.log("\n=== REPORT ===");
  console.log(`Files scanned: ${report.filesScanned}`);
  console.log(`Already linked: ${report.alreadyLinked}`);
  console.log(`Resources inserted: ${report.resourcesInserted}`);
  console.log(`Songs created: ${report.songsCreated}`);
  console.log(`No match: ${report.noMatch.length}`);
  console.log(`Errors: ${report.errors.length}`);

  if (report.noMatch.length > 0) {
    console.log(`\n── No Match (${report.noMatch.length}) ──`);
    for (const f of report.noMatch.slice(0, 50)) console.log(`  - ${f}`);
    if (report.noMatch.length > 50) console.log(`  ... and ${report.noMatch.length - 50} more`);
  }

  if (report.errors.length > 0) {
    console.log(`\n── Errors ──`);
    for (const e of report.errors) console.log(`  - ${e}`);
  }
}

main().catch(console.error);
