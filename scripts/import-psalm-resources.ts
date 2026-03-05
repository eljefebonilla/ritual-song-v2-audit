/**
 * Import psalm PDFs from Organized Psalms folder into song-library.json
 *
 * Scans: /Organized Psalms/{Season}/{Occasion}/Psalms/*.pdf
 * Matches PDFs to psalm songs by psalm number + normalized antiphon text
 * Adds resources with _psalms/ prefix paths (served by /api/music/[...path])
 *
 * Usage:
 *   npx tsx scripts/import-psalm-resources.ts --dry-run   # Preview only
 *   npx tsx scripts/import-psalm-resources.ts              # Live import
 */

import fs from "fs";
import path from "path";
import type { LibrarySong, SongResource } from "../src/lib/types";

// ───── CONFIGURATION ─────

const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");
const ORGANIZED_PSALMS_DIR = path.join(__dirname, "../../Organized Psalms");
const DRY_RUN = process.argv.includes("--dry-run");

// ───── HELPERS ─────

/** Normalize text for fuzzy comparison: lowercase, strip punctuation, collapse whitespace */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse psalm PDF filename into components */
function parsePsalmFilename(filename: string): {
  occasionId: string;
  psalmNumber: number;
  antiphonText: string;
  settingType: string; // "LyricPsalter", "LyricPsalterChoral", "LyricPsalter-INST", "Spirit&Psalm{year}"
  composer: string;
} | null {
  // Patterns:
  // Eas-02A_Ps-118_Give-Thanks-To-The-Lord_LyricPsalter_Haugen.pdf
  // Len-01A_Ps-51_Be-Merciful,-Be-Merciful,-O-Lord_Spirit&Psalm2026_Stephan.pdf
  // Len-01A_Be-Merciful-O-Lord_LyricPsalter-INST_Haugen.pdf  (no Ps-N prefix for INST)
  // Easter-07B_Ps-103_The-Lord-Has-Set-His-Throne_LyricPsalter_Haugen.pdf
  // Adv-01C_LyricPsalterChoral_Haugen.pdf  (minimal: no Ps-N, no antiphon)
  // Adv-03C_Isaiah-12_Cry-Out-With-Joy_LyricPsalterINST_Haugen.pdf  (no hyphen in INST)
  // Chr-BaptismB_Ps-X_..._LyricPsalterINST_Haugen.pdf  (Ps-X placeholder)

  const base = filename.replace(/\.pdf$/i, "");

  // Setting type pattern: matches all variants including LyricPsalterINST (no hyphen)
  const settingPat = "LyricPsalterChoral|LyricPsalter-?INST|LyricPsalter|Spirit&Psalm\\d{4}";

  // Try pattern with Ps-N (including Ps-X as unknown)
  const withPsNum = base.match(
    new RegExp(`^(.+?)_Ps-(\\d+|X)_(.+?)_(${settingPat})_(.+)$`)
  );
  if (withPsNum) {
    const rawNum = withPsNum[2];
    return {
      occasionId: withPsNum[1],
      psalmNumber: rawNum === "X" ? 0 : parseInt(rawNum, 10),
      antiphonText: withPsNum[3].replace(/-/g, " ").replace(/,\s*/g, ", "),
      settingType: withPsNum[4].replace("LyricPsalterINST", "LyricPsalter-INST"),
      composer: withPsNum[5],
    };
  }

  // Try canticle pattern: Luk-1, Isa-12, Isaiah-12, etc.
  const canticle = base.match(
    new RegExp(`^(.+?)_([A-Za-z]+-\\d+)_(.+?)_(${settingPat})_(.+)$`)
  );
  if (canticle) {
    return {
      occasionId: canticle[1],
      psalmNumber: 0, // canticle, not a psalm
      antiphonText: canticle[3].replace(/-/g, " ").replace(/,\s*/g, ", "),
      settingType: canticle[4].replace("LyricPsalterINST", "LyricPsalter-INST"),
      composer: canticle[5],
    };
  }

  // Try pattern without Ps-N (some INST/Choral files with just antiphon)
  const noPsNum = base.match(
    new RegExp(`^(.+?)_(.+?)_(${settingPat})_(.+)$`)
  );
  if (noPsNum) {
    return {
      occasionId: noPsNum[1],
      psalmNumber: 0, // will need to infer from context
      antiphonText: noPsNum[2].replace(/-/g, " ").replace(/,\s*/g, ", "),
      settingType: noPsNum[3].replace("LyricPsalterINST", "LyricPsalter-INST"),
      composer: noPsNum[4],
    };
  }

  // Minimal pattern: occasion_SettingType_Composer (no antiphon, no psalm number)
  const minimal = base.match(
    new RegExp(`^(.+?)_(${settingPat})_(.+)$`)
  );
  if (minimal) {
    return {
      occasionId: minimal[1],
      psalmNumber: 0,
      antiphonText: "",
      settingType: minimal[2].replace("LyricPsalterINST", "LyricPsalter-INST"),
      composer: minimal[3],
    };
  }

  return null;
}

/** Derive a human-readable label from setting type */
function settingLabel(settingType: string, composer: string): string {
  if (settingType === "LyricPsalterChoral") return `Lyric Psalter - Choral`;
  if (settingType === "LyricPsalter-INST") return `Lyric Psalter - Instrumental`;
  if (settingType.startsWith("LyricPsalter")) return `Lyric Psalter`;
  if (settingType.startsWith("Spirit&Psalm")) {
    const year = settingType.match(/\d{4}/)?.[0] || "";
    return year ? `Spirit & Psalm ${year}` : `Spirit & Psalm`;
  }
  return settingType;
}

/** Compute similarity between two strings (0-1) */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;

  // Check if one starts with the other
  if (na.startsWith(nb) || nb.startsWith(na)) return 0.9;

  // Word overlap score
  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const maxLen = Math.max(wordsA.size, wordsB.size);
  return maxLen > 0 ? overlap / maxLen : 0;
}

// ───── MAIN ─────

function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  // Load song library
  const library: LibrarySong[] = JSON.parse(
    fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
  );
  console.log(`Library has ${library.length} songs`);

  // Build psalm index: psalmNumber → songs[]
  const psalmIndex = new Map<number, LibrarySong[]>();
  // Build canticle index: "book chapter" → songs[] (e.g., "isaiah 12", "luke 1")
  const canticleIndex = new Map<string, LibrarySong[]>();
  for (const song of library) {
    if (song.category !== "psalm") continue;
    const psalmMatch = song.title.match(/^(?:psalm|ps\.?)\s*(\d+)/i);
    if (psalmMatch) {
      const num = parseInt(psalmMatch[1], 10);
      const arr = psalmIndex.get(num) || [];
      arr.push(song);
      psalmIndex.set(num, arr);
      continue;
    }
    // Check for canticle pattern: "Isaiah 12 ...", "Luke 1 ...", "Exodus 15 ...", "Daniel 3 ..."
    const canticleMatch = song.title.match(/^(Isaiah|Luke|Exodus|Daniel|Isa|Luk|Dan|Ex)\s*(\d+)/i);
    if (canticleMatch) {
      const book = canticleMatch[1].toLowerCase().replace(/^isa$/, "isaiah").replace(/^luk$/, "luke").replace(/^dan$/, "daniel").replace(/^ex$/, "exodus");
      const key = `${book} ${canticleMatch[2]}`;
      const arr = canticleIndex.get(key) || [];
      arr.push(song);
      canticleIndex.set(key, arr);
    }
  }
  console.log(`Psalm index: ${psalmIndex.size} unique psalm numbers, ${[...psalmIndex.values()].reduce((s, a) => s + a.length, 0)} songs`);
  console.log(`Canticle index: ${canticleIndex.size} canticles, ${[...canticleIndex.values()].reduce((s, a) => s + a.length, 0)} songs`);

  // Collect existing resource paths for deduplication
  const existingPaths = new Set<string>();
  for (const song of library) {
    for (const r of song.resources) {
      if (r.filePath) existingPaths.add(r.filePath);
    }
  }
  console.log(`Existing resource paths: ${existingPaths.size}`);

  // Scan Organized Psalms directory
  const seasons = fs.readdirSync(ORGANIZED_PSALMS_DIR).filter(
    (d) => fs.statSync(path.join(ORGANIZED_PSALMS_DIR, d)).isDirectory()
  );

  let scanned = 0;
  let matched = 0;
  let skippedDup = 0;
  let skippedNoMatch = 0;
  let added = 0;
  const noMatchFiles: string[] = [];
  const ambiguousMatches: string[] = [];

  for (const season of seasons) {
    const seasonDir = path.join(ORGANIZED_PSALMS_DIR, season);
    const occasions = fs.readdirSync(seasonDir).filter(
      (d) => fs.statSync(path.join(seasonDir, d)).isDirectory()
    );

    for (const occasion of occasions) {
      const psalmsDir = path.join(seasonDir, occasion, "Psalms");
      if (!fs.existsSync(psalmsDir)) continue;

      const files = fs.readdirSync(psalmsDir).filter((f) =>
        f.toLowerCase().endsWith(".pdf")
      );

      // Pre-parse all files to extract psalm numbers for cross-referencing
      const parsedFiles = files.map(f => ({ file: f, parsed: parsePsalmFilename(f) }));
      // Get the dominant psalm number from siblings (for inferring unknown psalm numbers)
      const siblingPsalmNums = parsedFiles
        .map(pf => pf.parsed?.psalmNumber)
        .filter((n): n is number => !!n && n > 0);
      const inferredPsalmNum = siblingPsalmNums.length > 0
        ? siblingPsalmNums.sort((a, b) =>
            siblingPsalmNums.filter(n => n === b).length - siblingPsalmNums.filter(n => n === a).length
          )[0]
        : null;

      for (const file of files) {
        scanned++;
        const relativePath = `_psalms/${season}/${occasion}/Psalms/${file}`;

        // Skip if already imported
        if (existingPaths.has(relativePath)) {
          skippedDup++;
          continue;
        }

        const parsed = parsePsalmFilename(file);
        if (!parsed) {
          noMatchFiles.push(`  PARSE FAIL: ${file}`);
          skippedNoMatch++;
          continue;
        }

        // Find matching songs by psalm number or canticle reference
        let effectivePsalmNum = parsed.psalmNumber;

        // If psalmNumber is 0, try to infer from sibling files in same folder
        if (effectivePsalmNum === 0 && inferredPsalmNum) {
          effectivePsalmNum = inferredPsalmNum;
        }

        let candidates = effectivePsalmNum > 0 ? (psalmIndex.get(effectivePsalmNum) || []) : [];

        // If psalmNumber is 0 and no psalm candidates, try canticle index
        if (candidates.length === 0 && parsed.psalmNumber === 0) {
          // Extract canticle book from the occasion or antiphon context
          const canticleRef = file.match(/(Isa|Isaiah|Luk|Luke|Dan|Daniel|Ex|Exodus)-?(\d+)/i);
          if (canticleRef) {
            const book = canticleRef[1].toLowerCase()
              .replace(/^isa$/, "isaiah").replace(/^luk$/, "luke")
              .replace(/^dan$/, "daniel").replace(/^ex$/, "exodus");
            const key = `${book} ${canticleRef[2]}`;
            candidates = canticleIndex.get(key) || [];
          }
        }

        // If still no candidates, try antiphon text match across all psalms and canticles
        if (candidates.length === 0 && parsed.antiphonText) {
          let bestMatch: LibrarySong | null = null;
          let bestScore = 0;
          const allPsalmSongs = [...psalmIndex.values(), ...canticleIndex.values()];
          for (const songs of allPsalmSongs) {
            for (const song of songs) {
              const titleAntiphon = song.title.replace(/^(?:psalm|ps\.?|isaiah|luke|exodus|daniel)\s*\d+\s*[:.]?\s*/i, "");
              const score = similarity(parsed.antiphonText, titleAntiphon);
              if (score > bestScore && score > 0.5) {
                bestScore = score;
                bestMatch = song;
              }
            }
          }
          if (bestMatch) {
            candidates = [bestMatch];
          }
        }

        if (candidates.length === 0) {
          noMatchFiles.push(`  NO MATCH: Ps ${parsed.psalmNumber} "${parsed.antiphonText}" — ${file}`);
          skippedNoMatch++;
          continue;
        }

        // Match to best candidate by antiphon text similarity
        let target: LibrarySong;
        if (candidates.length === 1) {
          target = candidates[0];
        } else {
          // Find best antiphon match
          let bestMatch = candidates[0];
          let bestScore = 0;
          for (const cand of candidates) {
            const titleAntiphon = cand.title.replace(/^(?:psalm|ps\.?|isaiah|luke|exodus|daniel)\s*\d+\s*[:.]?\s*/i, "");
            const score = similarity(parsed.antiphonText, titleAntiphon);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = cand;
            }
          }
          if (bestScore < 0.3) {
            ambiguousMatches.push(`  AMBIGUOUS: Ps ${parsed.psalmNumber} "${parsed.antiphonText}" (best=${bestScore.toFixed(2)}) — ${file}`);
            // Still assign to best match, just log it
          }
          target = bestMatch;
        }

        matched++;

        // Create the resource
        const label = settingLabel(parsed.settingType, parsed.composer);
        const resource: SongResource = {
          id: `psalm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "sheet_music",
          label,
          filePath: relativePath,
          source: "local",
        };

        if (!DRY_RUN) {
          target.resources.push(resource);
          existingPaths.add(relativePath); // prevent dups within this run
        }
        added++;
      }
    }
  }

  console.log("\n═══ RESULTS ═══");
  console.log(`Scanned:        ${scanned} PDFs`);
  console.log(`Already exists: ${skippedDup}`);
  console.log(`Matched:        ${matched}`);
  console.log(`Added:          ${added}`);
  console.log(`No match:       ${skippedNoMatch}`);

  if (noMatchFiles.length > 0) {
    console.log(`\nUnmatched files (${noMatchFiles.length}):`);
    for (const f of noMatchFiles.slice(0, 20)) console.log(f);
    if (noMatchFiles.length > 20) console.log(`  ... and ${noMatchFiles.length - 20} more`);
  }

  if (ambiguousMatches.length > 0) {
    console.log(`\nAmbiguous matches (${ambiguousMatches.length}):`);
    for (const f of ambiguousMatches.slice(0, 20)) console.log(f);
  }

  // Save
  if (!DRY_RUN && added > 0) {
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2) + "\n");
    console.log(`\nSaved ${added} new resources to song-library.json`);
  } else if (DRY_RUN) {
    console.log("\nDRY RUN — no changes written.");
  }
}

main();
