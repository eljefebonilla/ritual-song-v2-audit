/**
 * Add missing psalms and canticles to song-library.json
 * These are responsorial psalms/canticles that exist in the Organized Psalms
 * folder but not in the library. Per GIRM §61, canticles used as the
 * Responsorial Psalm are filed under category "psalm".
 *
 * Usage:
 *   npx tsx scripts/add-missing-psalms.ts --dry-run
 *   npx tsx scripts/add-missing-psalms.ts
 */

import fs from "fs";
import path from "path";
import type { LibrarySong } from "../src/lib/types";

const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");
const DRY_RUN = process.argv.includes("--dry-run");

function makeId(title: string, composer?: string): string {
  const base = [title, composer].filter(Boolean).join("--");
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Missing psalms and canticles to add
const MISSING_ENTRIES: Partial<LibrarySong>[] = [
  // === Missing Psalms ===
  { title: "Ps 17 Lord, when your glory appears, my joy will be full.", category: "psalm" },
  { title: "Ps 18 I love you, Lord, my strength.", category: "psalm" },
  { title: "Ps 45 The queen stands at your right hand.", category: "psalm" },
  { title: "Ps 54 The Lord upholds my life.", category: "psalm" },
  { title: "Ps 62 Rest in God alone, my soul.", category: "psalm" },
  { title: "Ps 97 A light will shine on us this day.", category: "psalm" },
  { title: "Ps 97 The Lord is king, the most high over all the earth.", category: "psalm" },
  { title: "Ps 105 The Holy Family.", category: "psalm" },
  { title: "Ps 131 In you, Lord, I have found my peace.", category: "psalm" },
  { title: "Ps 132 Lord, go up to the place of your rest.", category: "psalm" },
  { title: "Ps 147 Praise the Lord, who heals the brokenhearted.", category: "psalm" },
  { title: "Ps 147 Praise the Lord, Jerusalem.", category: "psalm" },

  // === Canticles used as Responsorial Psalm ===
  // Per GIRM §61, these occupy the Responsorial Psalm slot
  { title: "Isaiah 12 You will draw water joyfully.", category: "psalm" },
  { title: "Isaiah 12 Cry out with joy and gladness.", category: "psalm" },
  { title: "Luke 1 My soul rejoices in my God.", category: "psalm" },
  { title: "Exodus 15 Let us sing to the Lord.", category: "psalm" },
  { title: "Daniel 3 Glory and praise forever!", category: "psalm" },
];

function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  const library: LibrarySong[] = JSON.parse(
    fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
  );
  console.log(`Library has ${library.length} songs`);

  // Check for existing songs to avoid duplicates
  const existingTitles = new Set(library.map((s) => s.title.toLowerCase()));

  let added = 0;
  for (const entry of MISSING_ENTRIES) {
    if (existingTitles.has(entry.title!.toLowerCase())) {
      console.log(`  SKIP (exists): ${entry.title}`);
      continue;
    }

    const song: LibrarySong = {
      id: makeId(entry.title!),
      title: entry.title!,
      category: entry.category as LibrarySong["category"],
      resources: [],
      usageCount: 0,
      occasions: [],
    };

    console.log(`  ADD: ${song.title} (${song.id})`);

    if (!DRY_RUN) {
      library.push(song);
      existingTitles.add(song.title.toLowerCase());
    }
    added++;
  }

  console.log(`\nAdded: ${added} songs`);

  if (!DRY_RUN && added > 0) {
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2) + "\n");
    console.log("Saved to song-library.json");
    console.log("\nNow re-run: npx tsx scripts/import-psalm-resources.ts");
  } else if (DRY_RUN) {
    console.log("\nDRY RUN — no changes written.");
  }
}

main();
