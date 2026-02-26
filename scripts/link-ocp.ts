import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import type { LibrarySong, SongResource } from "../src/lib/types";

// ───── CONFIGURATION ─────

const BB_EXCEL_PATH = path.join(
  __dirname,
  "../../Song Folders/Music/_Title Slides/ARCHIVE/Breaking Bread 2025 Contents.xlsx"
);
const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");
const OCP_CATALOG_PATH = path.join(__dirname, "../src/data/ocp-bb-catalog.json");

// icrmusic.org subscription IDs
const BB_SUBSCRIPTION = "14"; // Breaking Bread
const SS_SUBSCRIPTION = "12"; // Spirit & Song

// BB number → OCP cluster ID mapping (scraped from icrmusic.org browse page)
const bbToCluster: Record<string, number> = JSON.parse(
  fs.readFileSync(OCP_CATALOG_PATH, "utf-8")
);

// ───── EXCEL PARSING ─────

interface BBEntry {
  bbNumber: number | string;
  title: string;
  composer: string;
  massTitle?: string;
  section?: string;
  moment?: string;
}

function parseBBExcel(): BBEntry[] {
  const wb = XLSX.readFile(BB_EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const entries: BBEntry[] = [];

  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !row[1]) continue;

    entries.push({
      bbNumber: row[0] as number | string,
      title: String(row[1]).trim(),
      composer: row[2] ? String(row[2]).trim() : "",
      massTitle: row[3] ? String(row[3]).trim() : undefined,
      section: row[6] ? String(row[6]).trim() : undefined,
      moment: row[7] ? String(row[7]).trim() : undefined,
    });
  }

  return entries;
}

// ───── MATCHING ─────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/_/g, " ")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract last-name-ish words from a composer string */
function composerWords(composer: string): string[] {
  return normalize(composer)
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter(
      (w) =>
        ![
          "arr",
          "arranged",
          "adapted",
          "the",
          "and",
          "by",
          "rev",
          "sr",
          "fr",
          "sj",
          "cssp",
          "csp",
          "op",
          "dc",
          "osb",
          "rsm",
        ].includes(w)
    );
}

/** Extract last names from BB "Last, First" format */
function bbLastNames(bbComposer: string): string[] {
  return bbComposer
    .split("/")
    .map((part) => {
      const pieces = part.trim().split(",").map((p) => p.trim());
      return pieces[0]; // first piece is the last name
    })
    .map((n) => normalize(n))
    .filter((n) => n.length > 2)
    .filter((n) => !["chant", "spiritual", "traditional"].includes(n));
}

/** Extract last names from library composer string */
function libLastNames(composer: string): string[] {
  // Library format: "First Last" or "First Last, Suffix"
  // Split on common separators
  return normalize(composer)
    .split(/[•·,&/]+/)
    .map((part) => {
      const words = part.trim().split(/\s+/).filter((w) => w.length > 2);
      // Filter out common non-name words
      const filtered = words.filter(
        (w) =>
          ![
            "arr",
            "arranged",
            "adapted",
            "the",
            "and",
            "by",
            "rev",
            "sr",
            "fr",
            "sj",
            "cssp",
            "csp",
            "op",
            "dc",
            "osb",
            "rsm",
          ].includes(w)
      );
      // Last word is likely the last name
      return filtered[filtered.length - 1] || "";
    })
    .filter((n) => n.length > 2);
}

/** BB Excel uses "Last, First" format — flip to "First Last" for matching */
function flipComposer(bbComposer: string): string {
  // Handle multi-composer: "Smith, John / Jones, Mary"
  return bbComposer
    .split("/")
    .map((part) => {
      const trimmed = part.trim();
      // Handle "Last, Suffix, First" e.g. "Dufford, SJ, Bob"
      const pieces = trimmed.split(",").map((p) => p.trim());
      if (pieces.length >= 2) {
        // Put first name first, last name last, drop suffixes
        const lastName = pieces[0];
        const firstName = pieces[pieces.length - 1];
        return `${firstName} ${lastName}`;
      }
      return trimmed;
    })
    .join(" ");
}

interface MatchResult {
  song: LibrarySong;
  confidence: "exact" | "title" | "fuzzy";
}

function findMatch(
  bbTitle: string,
  bbComposer: string,
  titleIndex: Map<string, LibrarySong[]>
): MatchResult | null {
  const normTitle = normalize(bbTitle);
  const flippedComposer = flipComposer(bbComposer);

  // 1. Exact title match (unique)
  const titleMatches = titleIndex.get(normTitle);
  if (titleMatches && titleMatches.length === 1) {
    return { song: titleMatches[0], confidence: "title" };
  }

  // 2. Title match with composer last-name overlap
  if (titleMatches && titleMatches.length > 0 && bbComposer) {
    const bbNames = bbLastNames(bbComposer);
    let bestMatch: LibrarySong | null = null;
    let bestOverlap = 0;

    for (const s of titleMatches) {
      const libNames = libLastNames(s.composer || "");
      // Also try general word matching
      const songWords = composerWords(s.composer || "");

      // Last name matching (more reliable)
      const nameOverlap = bbNames.filter((n) =>
        libNames.some((ln) => ln.includes(n) || n.includes(ln))
      ).length;

      // General word matching (fallback)
      const bbWords = composerWords(flipComposer(bbComposer));
      const wordOverlap = bbWords.filter((w) =>
        songWords.some((sw) => sw.includes(w) || w.includes(sw))
      ).length;

      const overlap = Math.max(nameOverlap, wordOverlap);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = s;
      }
    }

    if (bestMatch && bestOverlap > 0) {
      return { song: bestMatch, confidence: "exact" };
    }

    // If only one title match and no composer overlap, still match (likely same song, different composer formatting)
    if (titleMatches.length === 1) {
      return { song: titleMatches[0], confidence: "fuzzy" };
    }
  }

  // 3. Try without parentheticals or slashes in BB title
  // e.g., "Angels We Have Heard on High/Ángeles Cantando Están" → "Angels We Have Heard on High"
  const slashIdx = bbTitle.indexOf("/");
  if (slashIdx > 0) {
    const firstPart = normalize(bbTitle.substring(0, slashIdx).trim());
    const matches = titleIndex.get(firstPart);
    if (matches && matches.length === 1) {
      return { song: matches[0], confidence: "fuzzy" };
    }
  }

  // 4. Try removing parentheticals
  const cleanTitle = normalize(bbTitle.replace(/\(.*?\)/g, "").trim());
  if (cleanTitle !== normTitle && cleanTitle.length > 3) {
    const matches = titleIndex.get(cleanTitle);
    if (matches && matches.length === 1) {
      return { song: matches[0], confidence: "fuzzy" };
    }
  }

  // 5. Prefix matching (for titles that are truncated differently)
  for (const [indexTitle, songs] of titleIndex) {
    if (
      (indexTitle.startsWith(normTitle) || normTitle.startsWith(indexTitle)) &&
      Math.abs(indexTitle.length - normTitle.length) < 10 &&
      normTitle.length > 10
    ) {
      if (songs.length === 1) {
        return { song: songs[0], confidence: "fuzzy" };
      }
      // Multiple matches — try composer
      if (bbComposer) {
        const bbWords = composerWords(flippedComposer);
        for (const s of songs) {
          const songWords = composerWords(s.composer || "");
          if (
            bbWords.some((w) =>
              songWords.some((sw) => sw.includes(w) || w.includes(sw))
            )
          ) {
            return { song: s, confidence: "fuzzy" };
          }
        }
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

  console.log("Parsing Breaking Bread Excel...");
  const bbEntries = parseBBExcel();
  console.log(`BB catalog has ${bbEntries.length} entries`);

  // Build title index from library
  const titleIndex = new Map<string, LibrarySong[]>();
  for (const song of library) {
    const normTitle = normalize(song.title);
    if (!titleIndex.has(normTitle)) {
      titleIndex.set(normTitle, []);
    }
    titleIndex.get(normTitle)!.push(song);
  }

  // Match and link
  let matched = 0;
  let unmatched = 0;
  const unmatchedEntries: string[] = [];

  for (const bb of bbEntries) {
    // Skip non-numeric BB numbers (e.g. "Inside Back Cover")
    if (typeof bb.bbNumber !== "number") continue;

    const match = findMatch(bb.title, bb.composer, titleIndex);

    if (!match) {
      unmatched++;
      unmatchedEntries.push(`BB#${bb.bbNumber} ${bb.title} — ${bb.composer}`);
      continue;
    }

    matched++;
    const song = match.song;

    // Remove any previous BB resources for this song (always regenerate URLs)
    song.resources = song.resources.filter((r) => r.source !== "ocp_bb");

    // Look up cluster ID for correct URL
    const clusterId = bbToCluster[String(bb.bbNumber)];
    const url = clusterId
      ? `https://www.icrmusic.org/en-us/${BB_SUBSCRIPTION}/cluster/${clusterId}`
      : `https://www.icrmusic.org/en-us/${BB_SUBSCRIPTION}/cluster/search?q=${encodeURIComponent(bb.title)}`;

    const resource: SongResource = {
      id: `ocp-bb-${bb.bbNumber}`,
      type: "ocp_link",
      label: `Breaking Bread #${bb.bbNumber}`,
      url,
      value: String(bb.bbNumber),
      source: "ocp_bb",
    };

    song.resources.push(resource);
  }

  // Write updated library
  fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2));

  const songsWithOcp = library.filter((s) =>
    s.resources.some((r) => r.source === "ocp_bb")
  ).length;

  console.log(`\n=== Results ===`);
  console.log(
    `Matched: ${matched}/${bbEntries.filter((e) => typeof e.bbNumber === "number").length} BB entries (${Math.round((matched / bbEntries.filter((e) => typeof e.bbNumber === "number").length) * 100)}%)`
  );
  console.log(`Unmatched: ${unmatched} entries`);
  console.log(
    `Songs with OCP link: ${songsWithOcp}/${library.length}`
  );

  if (unmatchedEntries.length > 0 && unmatchedEntries.length <= 30) {
    console.log(`\nUnmatched BB entries:`);
    for (const e of unmatchedEntries) {
      console.log(`  ${e}`);
    }
  } else if (unmatchedEntries.length > 30) {
    console.log(`\nFirst 30 unmatched BB entries:`);
    for (const e of unmatchedEntries.slice(0, 30)) {
      console.log(`  ${e}`);
    }
    console.log(`  ... and ${unmatchedEntries.length - 30} more`);
  }
}

main();
