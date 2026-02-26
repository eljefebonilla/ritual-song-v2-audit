import fs from "fs";
import path from "path";
import type { LibrarySong, SongResource } from "../src/lib/types";

// ───── CONFIGURATION ─────

const MUSIC_DIR = path.join(__dirname, "../../Song Folders/Music");
const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");

// ───── FILE TYPE CLASSIFICATION ─────

interface FileInfo {
  name: string;
  relativePath: string; // relative to MUSIC_DIR
  ext: string;
  isAIM: boolean;
}

function classifyFile(
  fileName: string,
  ext: string,
  isAIM: boolean
): SongResource["type"] {
  const lower = ext.toLowerCase();
  if ([".mp3", ".wav", ".m4a", ".aif", ".aiff", ".ogg", ".flac"].includes(lower))
    return "audio";
  if ([".pdf"].includes(lower)) return "sheet_music";
  if ([".musx", ".mxl", ".musicxml", ".sib"].includes(lower)) return "notation";
  if ([".txt"].includes(lower)) return "lyrics";
  if ([".png", ".jpg", ".jpeg", ".gif", ".tif", ".tiff"].includes(lower))
    return "sheet_music"; // scanned sheet music images
  return "other";
}

function makeLabel(
  fileName: string,
  type: SongResource["type"],
  isAIM: boolean
): string {
  if (isAIM && type === "sheet_music") return "Lead Sheet (AIM)";
  if (isAIM && type === "audio") return "Audio (AIM)";

  // Use the file name without extension for descriptive label
  const base = path.basename(fileName, path.extname(fileName));

  // Try to make a clean label
  if (type === "sheet_music") {
    if (base.toLowerCase().includes("sat")) return "SAT Arrangement";
    if (base.toLowerCase().includes("satb")) return "SATB Arrangement";
    if (base.toLowerCase().includes("melody")) return "Melody";
    if (base.toLowerCase().includes("guitar")) return "Guitar";
    if (base.toLowerCase().includes("keyboard")) return "Keyboard";
    if (base.toLowerCase().includes("choral")) return "Choral";
    return "Sheet Music";
  }
  if (type === "audio") return "Audio Recording";
  if (type === "notation") return "Notation File";
  if (type === "lyrics") return "Lyrics";
  return base;
}

// ───── FOLDER SCANNING ─────

function scanMusicFolder(): Map<string, FileInfo[]> {
  const folderMap = new Map<string, FileInfo[]>();

  if (!fs.existsSync(MUSIC_DIR)) {
    console.error(`Music directory not found: ${MUSIC_DIR}`);
    return folderMap;
  }

  const entries = fs.readdirSync(MUSIC_DIR, { withFileTypes: true });

  for (const entry of entries) {
    // Skip non-directories and special folders
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;

    const folderPath = path.join(MUSIC_DIR, entry.name);
    const files: FileInfo[] = [];

    try {
      const folderFiles = fs.readdirSync(folderPath);
      for (const file of folderFiles) {
        if (file.startsWith(".")) continue;
        const ext = path.extname(file);
        if (!ext) continue;

        const type = classifyFile(file, ext, false);
        if (type === "other") continue; // Skip unknown file types

        const isAIM = file.toUpperCase().includes("AIM");
        files.push({
          name: file,
          relativePath: path.join(entry.name, file),
          ext,
          isAIM,
        });
      }
    } catch (e) {
      // Skip folders we can't read
    }

    if (files.length > 0) {
      folderMap.set(entry.name, files);
    }
  }

  return folderMap;
}

// ───── MATCHING ─────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/_/g, " ") // underscores → spaces (folder naming convention)
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize but also strip common suffixes/variations */
function normalizeFuzzy(text: string): string {
  return normalize(text)
    .replace(/\b(sj|cssp|csp|op|dc|osb)\b/g, "") // Religious order suffixes
    .replace(/\barr\.?\b/g, "")
    .replace(/\barranged?\s+by\b/g, "")
    .replace(/\badapted?\s+by\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitleAndComposer(
  folderName: string
): { title: string; composer: string } {
  // Pattern: "Song Title - Composer"
  const dashIdx = folderName.indexOf(" - ");
  if (dashIdx > 0) {
    return {
      title: folderName.substring(0, dashIdx).trim(),
      composer: folderName.substring(dashIdx + 3).trim(),
    };
  }
  return { title: folderName.trim(), composer: "" };
}

/** Extract just the last name(s) from a composer string */
function composerLastNames(composer: string): string[] {
  return normalize(composer)
    .split(/[•&,\/\s]+/)
    .filter((w) => w.length > 2); // skip short words like "by", "arr"
}

interface MatchResult {
  song: LibrarySong;
  confidence: "exact" | "title" | "fuzzy";
}

function findMatch(
  folderTitle: string,
  folderComposer: string,
  songIndex: Map<string, LibrarySong>,
  titleIndex: Map<string, LibrarySong[]>
): MatchResult | null {
  const normTitle = normalize(folderTitle);
  const normComposer = normalize(folderComposer);

  // 1. Exact normalized match (title + composer)
  const exactKey = `${normTitle}|||${normComposer}`;
  if (songIndex.has(exactKey)) {
    return { song: songIndex.get(exactKey)!, confidence: "exact" };
  }

  // 2. Title-only match (if unique)
  const titleMatches = titleIndex.get(normTitle);
  if (titleMatches && titleMatches.length === 1) {
    return { song: titleMatches[0], confidence: "title" };
  }

  // 3. Title match with composer word overlap
  if (titleMatches && titleMatches.length > 0 && normComposer) {
    const folderNames = composerLastNames(folderComposer);
    let bestMatch: LibrarySong | null = null;
    let bestOverlap = 0;

    for (const s of titleMatches) {
      const songNames = composerLastNames(s.composer || "");
      const overlap = folderNames.filter((n) =>
        songNames.some((sn) => sn.includes(n) || n.includes(sn))
      ).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = s;
      }
    }

    if (bestMatch && bestOverlap > 0) {
      return { song: bestMatch, confidence: "title" };
    }
    // Title matches but no composer overlap — return first if only title match
    if (titleMatches.length === 1) {
      return { song: titleMatches[0], confidence: "fuzzy" };
    }
  }

  // 4. Fuzzy: try removing parentheticals from folder title
  const cleanTitle = normalize(folderTitle.replace(/\(.*?\)/g, "").trim());
  if (cleanTitle !== normTitle && cleanTitle.length > 3) {
    const cleanMatches = titleIndex.get(cleanTitle);
    if (cleanMatches && cleanMatches.length === 1) {
      return { song: cleanMatches[0], confidence: "fuzzy" };
    }
    if (cleanMatches && cleanMatches.length > 1 && normComposer) {
      const folderNames = composerLastNames(folderComposer);
      for (const s of cleanMatches) {
        const songNames = composerLastNames(s.composer || "");
        if (folderNames.some((n) => songNames.some((sn) => sn.includes(n) || n.includes(sn)))) {
          return { song: s, confidence: "fuzzy" };
        }
      }
    }
  }

  // 5. Fuzzy: try title with common prefix variations
  // e.g., "Ps 51 Be merciful..." might match "Ps 51 Be merciful, O Lord..."
  for (const [indexTitle, songs] of titleIndex) {
    if (
      indexTitle.startsWith(normTitle) ||
      normTitle.startsWith(indexTitle)
    ) {
      if (
        Math.abs(indexTitle.length - normTitle.length) < 15 &&
        normTitle.length > 10
      ) {
        return { song: songs[0], confidence: "fuzzy" };
      }
    }
  }

  return null;
}

// ───── MAIN ─────

function main() {
  console.log("Loading song library...");
  const library: LibrarySong[] = JSON.parse(
    fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
  );
  console.log(`Library has ${library.length} songs`);

  // Build indexes
  const songIndex = new Map<string, LibrarySong>();
  const titleIndex = new Map<string, LibrarySong[]>();

  for (const song of library) {
    const normTitle = normalize(song.title);
    const normComposer = normalize(song.composer || "");
    songIndex.set(`${normTitle}|||${normComposer}`, song);

    if (!titleIndex.has(normTitle)) {
      titleIndex.set(normTitle, []);
    }
    titleIndex.get(normTitle)!.push(song);
  }

  console.log("Scanning music folder...");
  const folders = scanMusicFolder();
  console.log(`Found ${folders.size} song folders with files`);

  // Match and attach resources
  let matched = 0;
  let unmatched = 0;
  let totalResources = 0;
  const unmatchedFolders: string[] = [];

  for (const [folderName, files] of folders) {
    const { title, composer } = extractTitleAndComposer(folderName);
    const match = findMatch(title, composer, songIndex, titleIndex);

    if (!match) {
      unmatched++;
      unmatchedFolders.push(folderName);
      continue;
    }

    matched++;
    const song = match.song;

    // Clear any existing local resources before adding new ones
    song.resources = song.resources.filter((r) => r.source !== "local");

    // Sort files: AIM first, then by type
    const sorted = [...files].sort((a, b) => {
      if (a.isAIM && !b.isAIM) return -1;
      if (!a.isAIM && b.isAIM) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const file of sorted) {
      const type = classifyFile(file.name, file.ext, file.isAIM);
      const resource: SongResource = {
        id: `local-${slugify(file.relativePath)}`,
        type,
        label: makeLabel(file.name, type, file.isAIM),
        filePath: file.relativePath,
        source: "local",
        isHighlighted: file.isAIM || undefined,
      };
      song.resources.push(resource);
      totalResources++;
    }
  }

  // Write updated library
  fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2));

  console.log(`\n=== Results ===`);
  console.log(`Matched: ${matched}/${folders.size} folders (${Math.round((matched / folders.size) * 100)}%)`);
  console.log(`Unmatched: ${unmatched} folders`);
  console.log(`Total resources added: ${totalResources}`);
  console.log(
    `Songs with resources: ${library.filter((s) => s.resources.length > 0).length}/${library.length}`
  );

  if (unmatchedFolders.length > 0 && unmatchedFolders.length <= 50) {
    console.log(`\nUnmatched folders:`);
    for (const f of unmatchedFolders.slice(0, 50)) {
      console.log(`  ${f}`);
    }
  } else if (unmatchedFolders.length > 50) {
    console.log(`\nFirst 50 unmatched folders:`);
    for (const f of unmatchedFolders.slice(0, 50)) {
      console.log(`  ${f}`);
    }
    console.log(`  ... and ${unmatchedFolders.length - 50} more`);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

main();
