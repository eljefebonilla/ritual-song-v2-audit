import fs from "fs";
import path from "path";
import type { LibrarySong } from "../src/lib/types";

// ───── CONFIGURATION ─────

const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");
const DRY_RUN = process.argv.includes("--dry-run");

// ───── MAIN ─────

function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  console.log("Loading song library...");
  const library: LibrarySong[] = JSON.parse(
    fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
  );
  console.log(`Library has ${library.length} songs`);

  let promoted = 0;
  const promotedSongs: string[] = [];

  for (const song of library) {
    const bbResource = song.resources.find((r) => r.source === "ocp_bb");
    if (!bbResource || !bbResource.value) continue;

    const bbNumber = parseInt(bbResource.value, 10);
    if (isNaN(bbNumber)) {
      console.warn(`  Skipping "${song.title}" — non-numeric BB value: "${bbResource.value}"`);
      continue;
    }

    if (!song.catalogs) {
      song.catalogs = {};
    }
    song.catalogs.bb2026 = bbNumber;
    promoted++;
    promotedSongs.push(`  BB#${bbNumber} — ${song.title}`);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2));
    console.log(`\nWrote updated library to ${SONG_LIBRARY_PATH}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Songs with bb2026 catalog number: ${promoted}/${library.length}`);

  if (promoted <= 50) {
    console.log(`\nPromoted songs:`);
    for (const line of promotedSongs) {
      console.log(line);
    }
  } else {
    console.log(`\nFirst 30 promoted songs:`);
    for (const line of promotedSongs.slice(0, 30)) {
      console.log(line);
    }
    console.log(`  ... and ${promoted - 30} more`);
  }
}

main();
