/**
 * Import psalm resources from Song Folders/Music/_PSALMS/ into song-library.json
 *
 * These are individual psalm settings (lead sheets, recordings) organized by
 * psalm number. Different from the occasion-organized "Organized Psalms" folder.
 *
 * Path convention: files in Music/_PSALMS/ are served at /api/music/_PSALMS/...
 *
 * Usage:
 *   npx tsx scripts/import-psalms-folder.ts --dry-run
 *   npx tsx scripts/import-psalms-folder.ts
 */

import fs from "fs";
import path from "path";
import type { LibrarySong, SongResource } from "../src/lib/types";

const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");
const PSALMS_FOLDER = path.join(__dirname, "../../Song Folders/Music/_PSALMS");
const DRY_RUN = process.argv.includes("--dry-run");

const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".aif", ".aiff"]);
const SHEET_EXTS = new Set([".pdf"]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.startsWith(nb) || nb.startsWith(na)) return 0.9;
  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return Math.max(wordsA.size, wordsB.size) > 0
    ? overlap / Math.max(wordsA.size, wordsB.size)
    : 0;
}

/** Parse psalm number from folder/file name like "PS118 Give Thanks..." or "Ps112 ..." */
function parsePsFromName(name: string): { psalmNum: number; remainder: string } | null {
  const m = name.match(/^(?:PS|Ps|Psalm)\s*(\d+)\s*[-:]?\s*(.*)/i);
  if (m) return { psalmNum: parseInt(m[1], 10), remainder: m[2] };
  return null;
}

/** Derive label from filename */
function makeLabel(filename: string, ext: string): string {
  // Strip extension and psalm prefix
  let label = filename.replace(new RegExp(`\\${ext}$`, "i"), "");
  // Remove PS123 prefix
  label = label.replace(/^(?:PS|Ps|Psalm)\s*\d+\s*[-:]?\s*/i, "");
  // Clean up
  label = label.replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ").trim();
  return label || filename;
}

function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  const library: LibrarySong[] = JSON.parse(
    fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
  );

  // Build psalm index
  const psalmIndex = new Map<number, LibrarySong[]>();
  for (const song of library) {
    if (song.category !== "psalm") continue;
    const m = song.title.match(/^(?:psalm|ps\.?)\s*(\d+)/i);
    if (m) {
      const num = parseInt(m[1], 10);
      const arr = psalmIndex.get(num) || [];
      arr.push(song);
      psalmIndex.set(num, arr);
    }
  }
  console.log(`Psalm index: ${psalmIndex.size} numbers, ${[...psalmIndex.values()].reduce((s, a) => s + a.length, 0)} songs`);

  // Collect existing paths
  const existingPaths = new Set<string>();
  for (const song of library) {
    for (const r of song.resources) {
      if (r.filePath) existingPaths.add(r.filePath);
    }
  }

  let scanned = 0;
  let added = 0;
  let skippedDup = 0;
  let skippedNoMatch = 0;
  const noMatchFiles: string[] = [];

  // Recursively scan _PSALMS folder
  function scanDir(dir: string, relativeBase: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = `_PSALMS/${relativeBase ? relativeBase + "/" : ""}${entry.name}`;

      if (entry.isDirectory()) {
        scanDir(fullPath, relativeBase ? `${relativeBase}/${entry.name}` : entry.name);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!SHEET_EXTS.has(ext) && !AUDIO_EXTS.has(ext)) continue;

      scanned++;

      if (existingPaths.has(relativePath)) {
        skippedDup++;
        continue;
      }

      // Try to get psalm number from filename or parent directory
      let psalmNum: number | null = null;
      let remainder = "";

      const fromFile = parsePsFromName(entry.name);
      if (fromFile) {
        psalmNum = fromFile.psalmNum;
        remainder = fromFile.remainder;
      } else {
        // Try parent directory name
        const parentDir = path.basename(dir);
        const fromDir = parsePsFromName(parentDir);
        if (fromDir) {
          psalmNum = fromDir.psalmNum;
          remainder = entry.name.replace(new RegExp(`\\${ext}$`, "i"), "");
        }
      }

      if (!psalmNum || psalmNum > 150) {
        noMatchFiles.push(`  NO PSALM NUM: ${relativePath}`);
        skippedNoMatch++;
        continue;
      }

      const candidates = psalmIndex.get(psalmNum) || [];
      if (candidates.length === 0) {
        noMatchFiles.push(`  NO LIBRARY ENTRY: Ps ${psalmNum} — ${entry.name}`);
        skippedNoMatch++;
        continue;
      }

      // Match to best candidate by text similarity
      let target: LibrarySong;
      if (candidates.length === 1) {
        target = candidates[0];
      } else {
        let bestMatch = candidates[0];
        let bestScore = 0;
        for (const cand of candidates) {
          const titleAntiphon = cand.title.replace(/^(?:psalm|ps\.?)\s*\d+\s*[:.]?\s*/i, "");
          const score = similarity(remainder, titleAntiphon);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = cand;
          }
        }
        target = bestMatch;
      }

      const isAudio = AUDIO_EXTS.has(ext);
      const label = makeLabel(entry.name, ext);

      const resource: SongResource = {
        id: `psf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: isAudio ? "audio" : "sheet_music",
        label,
        filePath: relativePath,
        source: "local",
      };

      if (!DRY_RUN) {
        target.resources.push(resource);
        existingPaths.add(relativePath);
      }
      added++;
    }
  }

  scanDir(PSALMS_FOLDER, "");

  console.log("\n═══ RESULTS ═══");
  console.log(`Scanned:        ${scanned}`);
  console.log(`Already exists: ${skippedDup}`);
  console.log(`Added:          ${added}`);
  console.log(`No match:       ${skippedNoMatch}`);

  if (noMatchFiles.length > 0) {
    console.log(`\nUnmatched (${noMatchFiles.length}):`);
    for (const f of noMatchFiles.slice(0, 20)) console.log(f);
    if (noMatchFiles.length > 20) console.log(`  ... and ${noMatchFiles.length - 20} more`);
  }

  if (!DRY_RUN && added > 0) {
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2) + "\n");
    console.log(`\nSaved ${added} new resources to song-library.json`);
  }
}

main();
