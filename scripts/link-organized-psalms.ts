/**
 * link-organized-psalms.ts
 *
 * Walks all 296 folders in Organized Psalms/ and links their contents
 * to the Ritual Song app's occasion JSONs and song-library.json.
 *
 * Usage: npx tsx scripts/link-organized-psalms.ts
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join, extname, basename } from "path";

// ── Paths ────────────────────────────────────────────────────────────────────

const APP_ROOT = join(__dirname, "..");
const PSALMS_ROOT = join(APP_ROOT, "..", "Organized Psalms");
const OCCASIONS_DIR = join(APP_ROOT, "src", "data", "occasions");
const SONG_LIBRARY_PATH = join(APP_ROOT, "src", "data", "song-library.json");

// ── Types ────────────────────────────────────────────────────────────────────

interface OccasionResource {
  id: string;
  type: "sheet_music" | "audio";
  label: string;
  filePath: string;
  source: "local";
  category: "antiphon" | "gospel_acclamation";
}

interface SongResource {
  id: string;
  type: string;
  label: string;
  filePath?: string;
  source?: string;
  isHighlighted?: boolean;
  url?: string;
  storagePath?: string;
  value?: string;
}

interface LibrarySong {
  id: string;
  title: string;
  composer?: string;
  category?: string;
  functions?: string[];
  resources: SongResource[];
  usageCount: number;
  occasions: string[];
}

// ── Report tracking ──────────────────────────────────────────────────────────

const report = {
  foldersProcessed: 0,
  foldersSkipped: [] as string[],
  psalmFilesLinked: 0,
  psalmFilesSkipped: [] as string[],
  gaFilesLinked: 0,
  gaFilesSkipped: [] as string[],
  antiphonFilesLinked: 0,
  antiphonFilesSkipped: [] as string[],
  occasionJsonsUpdated: new Set<string>(),
  songLibraryUpdated: 0,
  warnings: [] as string[],
};

// ── Folder-to-OccasionID mapping ─────────────────────────────────────────────

function folderToOccasionId(
  season: string,
  folderName: string
): { id: string; year: string } | null {
  // Extract year letter from end of folder name
  const yearLetter = folderName.slice(-1);
  const year = yearLetter.toLowerCase();

  if (!["A", "B", "C"].includes(yearLetter)) {
    return null;
  }

  const base = folderName.slice(0, -1); // strip year letter

  // ── Advent ──
  if (season === "Advent") {
    const m = base.match(/^Adv-(\d{2})$/);
    if (m) {
      const nn = parseInt(m[1], 10);
      return { id: `advent-${String(nn).padStart(2, "0")}-${year}`, year };
    }
  }

  // ── Ordinary Time ──
  if (season === "Ordinary Time") {
    const m = base.match(/^OT-(\d{2})$/);
    if (m) {
      const nn = parseInt(m[1], 10);
      // OT-01 has no matching occasion JSON
      if (nn === 1) return null;
      // OT-34 is Christ the King
      if (nn === 34)
        return { id: `solemnity-christ-the-king-${year}`, year };
      // OT-03 is Word of God Sunday
      if (nn === 3)
        return {
          id: `ordinary-time-03-${year}-word-of-god-sunday`,
          year,
        };
      return {
        id: `ordinary-time-${String(nn).padStart(2, "0")}-${year}`,
        year,
      };
    }
  }

  // ── Lent ──
  if (season === "Lent") {
    const numMatch = base.match(/^Len-(\d{2})$/);
    if (numMatch) {
      const nn = parseInt(numMatch[1], 10);
      // Scrutiny suffixes for Year A
      if (nn === 3 && year === "a")
        return { id: "lent-03-a-first-scrutiny", year };
      if (nn === 4 && year === "a")
        return { id: "lent-04-a-second-scrutiny", year };
      if (nn === 5 && year === "a")
        return { id: "lent-05-a-third-scrutiny", year };
      return {
        id: `lent-${String(nn).padStart(2, "0")}-${year}`,
        year,
      };
    }
    if (base === "Len-Ash-Wed") return { id: "ash-wednesday", year };
    if (base === "Len-Palm-Sunday") return { id: `palm-sunday-${year}`, year };
    // No occasion JSONs for these
    if (base === "Len-Good-Friday") return null;
    if (base === "Len-Holy-Thursday") return null;
    if (base === "Len-Chrism-Mass") return null;
  }

  // ── Easter ──
  if (season === "Easter") {
    const numMatch = base.match(/^Eas-(\d{2})$/);
    if (numMatch) {
      const nn = parseInt(numMatch[1], 10);
      if (nn === 2) return { id: `easter-02-divine-mercy-${year}`, year };
      return {
        id: `easter-${String(nn).padStart(2, "0")}-${year}`,
        year,
      };
    }
    if (base === "Eas-Ascension") return { id: `ascension-${year}`, year };
    if (base === "Eas-Easter-Sunday")
      return { id: "easter-sunday-abc", year };
    if (base === "Eas-Pentecost") return { id: `pentecost-${year}`, year };
    if (base === "Eas-PentecostVigil")
      return { id: "pentecost-vigil-abc", year };
    // Easter Vigil readings have no individual occasion JSONs
    if (base.startsWith("Eas-Easter-Vigil")) return null;
  }

  // ── Christmas ──
  if (season === "Christmas") {
    if (base === "Chr-Baptism")
      return { id: `baptism-of-the-lord-${year}`, year };
    if (base === "Chr-Epiphany")
      return { id: "the-epiphany-of-the-lord-abc", year };
    if (base === "Chr-Holy-Family")
      return { id: `holy-family-${year}`, year };
    if (base === "Chr-Immaculate-Conception")
      return { id: "solemnity-immaculate-conception", year };
    if (base === "Chr-2nd-After-Christmas")
      return {
        id: "2nd-sun-after-christmas-abc-epiphany-replaces-in-adla",
        year,
      };
    if (base === "Chr-Mary-Mother-Of-God")
      return { id: "jan-1-mary-mother-of-god-abc", year };
    // Christmas Vigil/Night/Dawn/Day → nativity (generic)
    if (
      base === "Chr-Christmas-Vigil" ||
      base === "Chr-Christmas-Night" ||
      base === "Chr-Christmas-Dawn" ||
      base === "Chr-Christmas-Day"
    ) {
      return { id: "nativity", year };
    }
  }

  // ── Solemnities ──
  if (season === "Solemnities") {
    if (base === "Sol-All-Saints")
      return { id: "solemnity-nov-1-all-saints-abc", year };
    if (base === "Sol-All-Souls")
      return { id: "solemnity-nov-1-all-souls-abc", year };
    if (base === "Sol-Body-And-Blood")
      return { id: `solemnity-body-blood-of-christ-${year}`, year };
    if (base === "Sol-Christ-The-King")
      return { id: `solemnity-christ-the-king-${year}`, year };
    if (base === "Sol-Exaltation-Holy-Cross")
      return {
        id: "feast-the-exaltation-sep-14-of-the-holy-cross-abc",
        year,
      };
    if (base === "Sol-Guadalupe")
      return { id: "feast-our-lady-of-guadalupe-abc", year };
    if (base === "Sol-Holy-Trinity")
      return { id: `solemnity-most-holy-trinity-${year}`, year };
    if (base === "Sol-Lateran-Basilica")
      return {
        id: "the-dedication-of-nov-9-the-lateran-basilica-abc",
        year,
      };
    if (base === "Sol-Peter-Paul")
      return {
        id: "ss-peter-paul-apostles-jun-29-mass-during-the-day-abc",
        year,
      };
    if (base === "Sol-Peter-Paul-Vigil")
      return {
        id: "ss-peter-paul-apostles-jun-29-at-the-vigil-mass-abc",
        year,
      };
    if (base === "Sol-Presentation")
      return { id: "feast-abc-feb-2-presentation-of-the-lord", year };
    if (base === "Sol-Thanksgiving")
      return { id: "thanksgiving", year };
    if (base === "Sol-Independence-Day")
      return { id: "independence-day", year };
    // No matching JSONs for these
    if (base === "Sol-Sacred-Heart") return null;
    if (base === "Sol-Assumption-Day") return null;
    if (base === "Sol-Assumption-Vigil") return null;
    if (base === "Sol-St-Joseph") return null;
    if (base === "Sol-Annunciation") return null;
    if (base === "Sol-John-Baptist") return null;
    if (base === "Sol-Labor-Day") return null;
    if (base === "Sol-Transfiguration") return null;
  }

  return null;
}

// ── Psalm matching helpers ───────────────────────────────────────────────────

interface PsalmIndex {
  psalmNum: number;
  collection: "lyric_psalter" | "spirit_psalm" | "other";
  antiphonWords: string[];
  song: LibrarySong;
}

function buildPsalmIndex(songs: LibrarySong[]): PsalmIndex[] {
  const index: PsalmIndex[] = [];

  for (const song of songs) {
    if (song.category !== "psalm") continue;

    // Extract psalm number from title: "Ps 122 Let us go..." or "Psalm 23: Shepherd Me..."
    const numMatch = song.title.match(/^Ps(?:alm)?\s+(\d+)/i);
    if (!numMatch) continue;

    const psalmNum = parseInt(numMatch[1], 10);

    // Determine collection from composer field
    let collection: "lyric_psalter" | "spirit_psalm" | "other" = "other";
    const comp = (song.composer || "").toLowerCase();
    if (comp.includes("lyric psalter") || comp.includes("lyric psaltes")) {
      collection = "lyric_psalter";
    } else if (comp.includes("spirit") && comp.includes("psalm")) {
      collection = "spirit_psalm";
    }

    // Extract antiphon words from title (after psalm number)
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
} {
  const parts = filename.replace(/\.pdf$/, "").split("_");

  let psalmNum: number | null = null;
  let collection: "lyric_psalter" | "spirit_psalm" | "other" = "other";
  let variant = "";
  const antiphonWords: string[] = [];

  for (const part of parts) {
    // Psalm number
    const psMatch = part.match(/^Ps-(\d+)$/i);
    if (psMatch) {
      psalmNum = parseInt(psMatch[1], 10);
      continue;
    }
    // Also handle Luk-1, Isa-12, Isaiah-12 (canticles)
    const canticleMatch = part.match(/^(?:Luk|Isa|Isaiah)-(\d+)$/i);
    if (canticleMatch) {
      // Use negative numbers for canticles to avoid psalm collision
      psalmNum = -parseInt(canticleMatch[1], 10);
      continue;
    }

    // Collection detection
    if (part === "LyricPsalter") {
      collection = "lyric_psalter";
      variant = "lead_sheet";
    } else if (part === "LyricPsalterChoral") {
      collection = "lyric_psalter";
      variant = "choral";
    } else if (
      part === "LyricPsalter-INST" ||
      part === "LyricPsalterINST"
    ) {
      collection = "lyric_psalter";
      variant = "instrumental";
    } else if (part.startsWith("Spirit&Psalm")) {
      collection = "spirit_psalm";
      variant = "lead_sheet";
    }
  }

  // Extract antiphon words from hyphenated parts (skip folder code, psalm num, collection, composer)
  // Pattern: code_Ps-nn_Antiphon-Words-Here_Collection_Composer
  // We want the antiphon words
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p.match(/^Ps-\d+$/i)) continue;
    if (p.match(/^(?:Luk|Isa|Isaiah)-\d+$/i)) continue;
    if (p.match(/^LyricPsalter/)) break;
    if (p.match(/^Spirit&Psalm/)) break;
    // This is an antiphon word segment
    const words = p
      .replace(/-/g, " ")
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    antiphonWords.push(...words);
  }

  return { psalmNum, collection, variant, antiphonWords };
}

function matchPsalmToSong(
  psalmNum: number,
  collection: "lyric_psalter" | "spirit_psalm" | "other",
  antiphonWords: string[],
  index: PsalmIndex[]
): LibrarySong | null {
  // Filter by psalm number and collection
  let candidates = index.filter(
    (p) => p.psalmNum === psalmNum && p.collection === collection
  );

  // If no exact collection match, try any collection with that psalm num
  if (candidates.length === 0) {
    candidates = index.filter((p) => p.psalmNum === psalmNum);
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].song;

  // Score by antiphon word overlap
  let bestScore = -1;
  let bestSong: LibrarySong | null = null;

  for (const c of candidates) {
    let score = 0;
    for (const word of antiphonWords) {
      if (c.antiphonWords.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSong = c.song;
    }
  }

  // Require minimum overlap of 2 words for ambiguous matches
  if (candidates.length > 1 && bestScore < 2) {
    return null;
  }

  return bestSong;
}

function psalmResourceLabel(variant: string, collection: string): string {
  if (collection === "lyric_psalter") {
    if (variant === "choral") return "Lyric Psalter - Choral";
    if (variant === "instrumental") return "Lyric Psalter - Instrumental";
    return "Lyric Psalter";
  }
  return "Spirit & Psalm";
}

// ── GA / Antiphon helpers ────────────────────────────────────────────────────

function isSkippableGA(filename: string): boolean {
  return (
    filename.startsWith("CantorsBook-") ||
    filename.startsWith("Alonso-") ||
    // Year-letter-only generic files like "Adv-B_GospelAcc.pdf" or "Chr-B_GospelAcc.pdf"
    /^[A-Z][a-z]+-[ABC]_GospelAcc/.test(filename)
  );
}

function gaResourceLabel(filename: string): string {
  if (filename.includes("_Gospel-Acclamation_Spirit&Psalm")) {
    // Extract composer from end: *_Spirit&Psalm2026_Hart.pdf → Hart
    const parts = filename.replace(/\.pdf$/, "").split("_");
    const composer = parts[parts.length - 1];
    return `Gospel Acclamation - Spirit & Psalm (${composer})`;
  }
  if (filename.includes("GospelAcc") && filename.includes("Alonso")) {
    return "Gospel Acclamation (Alonso)";
  }
  // MP3 files — use as-is
  if (extname(filename).toLowerCase() === ".mp3") {
    return "Gospel Acclamation";
  }
  return "Gospel Acclamation";
}

function antiphonResourceLabel(filename: string): string {
  if (filename.includes("_Antiphons_REJOICE")) {
    return "REJOICE Antiphons";
  }
  // REJOICE MP3s — extract entrance/communion info
  // Format: REJOICE_CODE Title_Words_Here_Nth_Sunday_..._Entrance_Antiphon_NN.mp3
  if (filename.startsWith("REJOICE_")) {
    const base = filename.replace(/\.mp3$/, "");
    // Find the antiphon type and extract title
    const entranceMatch = base.match(
      /REJOICE_[A-Z0-9 ]+ (.+)_Entrance_Antiphon/i
    );
    const communionMatch = base.match(
      /REJOICE_[A-Z0-9 ]+ (.+)_Communion_Antiphon/i
    );
    if (entranceMatch) {
      // Strip the occasion descriptor (e.g., "1st_Sunday_Of_Advent_")
      const raw = entranceMatch[1];
      const titlePart = raw.replace(
        /_\d+(?:st|nd|rd|th)_Sunday_[A-Za-z_]+$/i,
        ""
      ).replace(/_All_Saints$/i, "").replace(/_[A-Z][a-z]+_[A-Z][a-z]+$/i, "");
      const title = titlePart.replace(/_/g, " ").trim();
      return `Entrance: ${title}`;
    }
    if (communionMatch) {
      const raw = communionMatch[1];
      const titlePart = raw.replace(
        /_\d+(?:st|nd|rd|th)_Sunday_[A-Za-z_]+$/i,
        ""
      ).replace(/_All_Saints$/i, "").replace(/_[A-Z][a-z]+_[A-Z][a-z]+$/i, "");
      const title = titlePart.replace(/_/g, " ").trim();
      return `Communion: ${title}`;
    }
    // Fallback
    return "REJOICE Antiphon";
  }
  // Lyric Psalter antiphon PDFs in the Antiphons folder
  if (filename.includes("LyricPsalter")) {
    return "Lyric Psalter Antiphon";
  }
  return basename(filename, extname(filename));
}

function makeResourceId(filePath: string): string {
  return (
    "psalms-" +
    filePath
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase()
      .slice(0, 80)
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log("=== Link Organized Psalms ===\n");

  // Load song library
  const songLibrary: LibrarySong[] = JSON.parse(
    readFileSync(SONG_LIBRARY_PATH, "utf-8")
  );

  // Clean: strip any existing _psalms/ resources from songs and occasion JSONs
  console.log("Cleaning previous _psalms/ resources...");
  let cleanedSongs = 0;
  for (const song of songLibrary) {
    const before = song.resources.length;
    song.resources = song.resources.filter(
      (r) => !r.filePath?.startsWith("_psalms/")
    );
    if (song.resources.length < before) cleanedSongs++;
  }

  let cleanedOccasions = 0;
  const occasionFiles = readdirSync(OCCASIONS_DIR).filter((f) =>
    f.endsWith(".json")
  );
  for (const file of occasionFiles) {
    const path = join(OCCASIONS_DIR, file);
    const data = JSON.parse(readFileSync(path, "utf-8"));
    if (data.occasionResources && data.occasionResources.length > 0) {
      data.occasionResources = [];
      writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
      cleanedOccasions++;
    }
  }
  console.log(
    `  Cleaned ${cleanedSongs} songs, ${cleanedOccasions} occasion JSONs.\n`
  );

  const psalmIndex = buildPsalmIndex(songLibrary);
  console.log(
    `Loaded ${songLibrary.length} songs, ${psalmIndex.length} psalm entries indexed.\n`
  );

  // Cache for occasion JSONs (key: occasion ID)
  const occasionCache = new Map<string, any>();
  // Track which occasion JSONs are dirty
  const dirtyOccasions = new Set<string>();
  // Track which songs got new resources
  const dirtySongs = new Set<string>();
  // Track filenames already added to occasions (for ABC dedup)
  const occasionFilesSeen = new Map<string, Set<string>>();

  function getOccasionJson(id: string): any | null {
    if (occasionCache.has(id)) return occasionCache.get(id);
    const path = join(OCCASIONS_DIR, `${id}.json`);
    if (!existsSync(path)) return null;
    const data = JSON.parse(readFileSync(path, "utf-8"));
    occasionCache.set(id, data);
    return data;
  }

  function getFilesSeenSet(occasionId: string): Set<string> {
    if (!occasionFilesSeen.has(occasionId)) {
      occasionFilesSeen.set(occasionId, new Set());
    }
    return occasionFilesSeen.get(occasionId)!;
  }

  // For ABC dedup: normalize filename by stripping folder-code prefix
  // e.g., "Sol-All-SaintsA_GospelAcc_Alonso.pdf" → "GospelAcc_Alonso.pdf"
  // "Adv-01A_GospelAcc_Alonso.pdf" → "GospelAcc_Alonso.pdf"
  // REJOICE files don't have the prefix so they pass through unchanged
  function dedupKey(filename: string): string {
    // Strip leading folder code: anything up to and including the first underscore
    // BUT only if it matches known folder code patterns
    const prefixMatch = filename.match(
      /^(?:[A-Z][a-z]+-[A-Za-z0-9-]+[ABC]|[A-Z]+-\d{2}[ABC]|[A-Z]+-[A-Za-z-]+[ABC]|Easter-Day-[ABC]|BaptismLord-[ABC])_(.+)$/
    );
    if (prefixMatch) return prefixMatch[1];
    return filename;
  }

  // Walk all season directories
  const seasons = readdirSync(PSALMS_ROOT).filter((d) => {
    const full = join(PSALMS_ROOT, d);
    return statSync(full).isDirectory();
  });

  for (const season of seasons) {
    const seasonDir = join(PSALMS_ROOT, season);
    const folders = readdirSync(seasonDir)
      .filter((d) => statSync(join(seasonDir, d)).isDirectory())
      .sort();

    for (const folder of folders) {
      const mapping = folderToOccasionId(season, folder);
      if (!mapping) {
        report.foldersSkipped.push(`${season}/${folder}`);
        continue;
      }

      const occasionId = mapping.id;
      const occasionJson = getOccasionJson(occasionId);
      if (!occasionJson) {
        report.foldersSkipped.push(
          `${season}/${folder} → ${occasionId} (no JSON)`
        );
        report.warnings.push(
          `No occasion JSON found: ${occasionId} (from ${season}/${folder})`
        );
        continue;
      }

      report.foldersProcessed++;
      const folderPath = join(seasonDir, folder);
      const filesSeen = getFilesSeenSet(occasionId);

      // Initialize occasionResources array if needed
      if (!occasionJson.occasionResources) {
        occasionJson.occasionResources = [];
      }

      // ── Process Psalms ──
      const psalmsDir = join(folderPath, "Psalms");
      if (existsSync(psalmsDir)) {
        const psalmFiles = readdirSync(psalmsDir).filter(
          (f) => extname(f).toLowerCase() === ".pdf"
        );

        for (const pf of psalmFiles) {
          const parsed = parsePsalmFilename(pf);
          if (parsed.psalmNum === null) {
            report.psalmFilesSkipped.push(`${season}/${folder}/Psalms/${pf} (no psalm number)`);
            continue;
          }

          const matched = matchPsalmToSong(
            parsed.psalmNum,
            parsed.collection,
            parsed.antiphonWords,
            psalmIndex
          );

          if (!matched) {
            report.psalmFilesSkipped.push(
              `${season}/${folder}/Psalms/${pf} (no song match for Ps ${parsed.psalmNum} ${parsed.collection})`
            );
            continue;
          }

          // Build the _psalms/ prefixed file path
          const psalmFilePath = `_psalms/${season}/${folder}/Psalms/${pf}`;

          // Check if this resource already exists on the song
          const alreadyHas = matched.resources.some(
            (r) => r.filePath === psalmFilePath
          );
          if (alreadyHas) continue;

          const label = psalmResourceLabel(parsed.variant, parsed.collection);

          matched.resources.push({
            id: makeResourceId(psalmFilePath),
            type: parsed.variant === "instrumental" ? "audio" : "sheet_music",
            label,
            filePath: psalmFilePath,
            source: "local",
          });

          dirtySongs.add(matched.id);
          report.psalmFilesLinked++;
        }
      }

      // ── Process Gospel Acclamations ──
      const gaDir = join(folderPath, "Gospel Acclamations");
      if (existsSync(gaDir)) {
        const gaFiles = readdirSync(gaDir);

        for (const gf of gaFiles) {
          const ext = extname(gf).toLowerCase();
          if (ext !== ".pdf" && ext !== ".mp3") continue;

          // Skip generic/seasonal duplicates
          if (isSkippableGA(gf)) {
            report.gaFilesSkipped.push(
              `${season}/${folder}/Gospel Acclamations/${gf} (generic/seasonal)`
            );
            continue;
          }

          // Deduplicate across ABC folders mapping to same occasion
          const gaKey = dedupKey(gf);
          if (filesSeen.has(gaKey)) continue;
          filesSeen.add(gaKey);

          const gaFilePath = `_psalms/${season}/${folder}/Gospel Acclamations/${gf}`;
          const label = gaResourceLabel(gf);

          // Check if already exists
          const existing = (
            occasionJson.occasionResources as OccasionResource[]
          ).find((r) => r.filePath === gaFilePath);
          if (existing) continue;

          const resource: OccasionResource = {
            id: makeResourceId(gaFilePath),
            type: ext === ".mp3" ? "audio" : "sheet_music",
            label,
            filePath: gaFilePath,
            source: "local",
            category: "gospel_acclamation",
          };

          occasionJson.occasionResources.push(resource);
          dirtyOccasions.add(occasionId);
          report.gaFilesLinked++;
        }
      }

      // ── Process Antiphons ──
      const antDir = join(folderPath, "Antiphons");
      if (existsSync(antDir)) {
        const antFiles = readdirSync(antDir);

        for (const af of antFiles) {
          const ext = extname(af).toLowerCase();
          if (ext !== ".pdf" && ext !== ".mp3") continue;

          // Deduplicate across ABC folders mapping to same occasion
          const antKey = dedupKey(af);
          if (filesSeen.has(antKey)) continue;
          filesSeen.add(antKey);

          const antFilePath = `_psalms/${season}/${folder}/Antiphons/${af}`;
          const label = antiphonResourceLabel(af);

          // Check if already exists
          const existing = (
            occasionJson.occasionResources as OccasionResource[]
          ).find((r) => r.filePath === antFilePath);
          if (existing) continue;

          const resource: OccasionResource = {
            id: makeResourceId(antFilePath),
            type: ext === ".mp3" ? "audio" : "sheet_music",
            label,
            filePath: antFilePath,
            source: "local",
            category: "antiphon",
          };

          occasionJson.occasionResources.push(resource);
          dirtyOccasions.add(occasionId);
          report.antiphonFilesLinked++;
        }
      }
    }
  }

  // ── Write updated occasion JSONs ──
  for (const id of dirtyOccasions) {
    const data = occasionCache.get(id)!;
    const path = join(OCCASIONS_DIR, `${id}.json`);
    writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
    report.occasionJsonsUpdated.add(id);
  }

  // ── Write updated song library ──
  report.songLibraryUpdated = dirtySongs.size;
  if (dirtySongs.size > 0) {
    writeFileSync(
      SONG_LIBRARY_PATH,
      JSON.stringify(songLibrary, null, 2) + "\n"
    );
  }

  // ── Print report ──
  console.log("=== REPORT ===\n");
  console.log(`Folders processed: ${report.foldersProcessed}`);
  console.log(`Folders skipped: ${report.foldersSkipped.length}`);
  console.log(
    `Occasion JSONs updated: ${report.occasionJsonsUpdated.size}`
  );
  console.log(`Songs with new resources: ${report.songLibraryUpdated}`);
  console.log();
  console.log(`Psalm files linked: ${report.psalmFilesLinked}`);
  console.log(`Psalm files skipped: ${report.psalmFilesSkipped.length}`);
  console.log(`GA files linked: ${report.gaFilesLinked}`);
  console.log(`GA files skipped: ${report.gaFilesSkipped.length}`);
  console.log(`Antiphon files linked: ${report.antiphonFilesLinked}`);
  console.log(`Antiphon files skipped: ${report.antiphonFilesSkipped.length}`);

  if (report.warnings.length > 0) {
    console.log(`\n── Warnings (${report.warnings.length}) ──`);
    for (const w of report.warnings) console.log(`  ⚠ ${w}`);
  }

  if (report.foldersSkipped.length > 0) {
    console.log(
      `\n── Skipped Folders (${report.foldersSkipped.length}) ──`
    );
    for (const f of report.foldersSkipped) console.log(`  - ${f}`);
  }

  if (report.psalmFilesSkipped.length > 0) {
    console.log(
      `\n── Skipped Psalm Files (${report.psalmFilesSkipped.length}) ──`
    );
    for (const f of report.psalmFilesSkipped) console.log(`  - ${f}`);
  }

  if (report.gaFilesSkipped.length > 0) {
    console.log(
      `\n── Skipped GA Files (${report.gaFilesSkipped.length}) ──`
    );
    for (const f of report.gaFilesSkipped) console.log(`  - ${f}`);
  }

  if (report.antiphonFilesSkipped.length > 0) {
    console.log(
      `\n── Skipped Antiphon Files (${report.antiphonFilesSkipped.length}) ──`
    );
    for (const f of report.antiphonFilesSkipped) console.log(`  - ${f}`);
  }

  console.log(
    `\n── Updated Occasion JSONs (${report.occasionJsonsUpdated.size}) ──`
  );
  for (const id of [...report.occasionJsonsUpdated].sort())
    console.log(`  + ${id}`);

  console.log("\nDone.");
}

main();
