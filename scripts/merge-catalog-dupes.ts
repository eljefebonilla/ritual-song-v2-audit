import fs from "fs";
import path from "path";
import type { LibrarySong } from "../src/lib/types";

const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");
const DRY_RUN = process.argv.includes("--dry-run");

function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");

  const library: LibrarySong[] = JSON.parse(
    fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
  );
  console.log(`Library has ${library.length} songs`);

  // Group songs by lowercase title
  const byTitle = new Map<string, number[]>();
  for (let i = 0; i < library.length; i++) {
    const key = library[i].title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(i);
  }

  const idsToRemove = new Set<string>();
  let mergedGroups = 0;
  let catalogsMoved = 0;
  let topicsMoved = 0;
  let scriptureRefsMoved = 0;
  const mergeLog: string[] = [];

  for (const [title, indices] of byTitle) {
    const songs = indices.map((i) => library[i]);

    // Find resourced songs (originals) and catalog-only songs (import dupes)
    const withResources = songs.filter((s) => s.resources.length > 0);
    const catalogOnly = songs.filter(
      (s) =>
        s.resources.length === 0 &&
        s.catalogs &&
        Object.keys(s.catalogs).length > 0
    );

    if (withResources.length === 0 || catalogOnly.length === 0) continue;

    // Pick the best target: the resourced song with the most resources
    const target = withResources.sort(
      (a, b) => b.resources.length - a.resources.length
    )[0];

    if (!target.catalogs) target.catalogs = {};

    const log: string[] = [];
    log.push(`"${target.title}" [${target.id}] (${target.resources.length} resources)`);

    for (const dupe of catalogOnly) {
      const movedCats: string[] = [];

      // Merge catalog numbers (don't overwrite existing)
      for (const [key, val] of Object.entries(dupe.catalogs!)) {
        if (!(key in target.catalogs!)) {
          (target.catalogs as Record<string, number>)[key] = val as number;
          movedCats.push(`${key}=${val}`);
          catalogsMoved++;
        }
      }

      // Merge topics
      if (dupe.topics && dupe.topics.length > 0) {
        const existing = new Set(target.topics || []);
        for (const t of dupe.topics) {
          if (!existing.has(t)) {
            topicsMoved++;
            existing.add(t);
          }
        }
        target.topics = [...existing];
      }

      // Merge scripture refs
      if (dupe.scriptureRefs && dupe.scriptureRefs.length > 0) {
        const existing = new Set(target.scriptureRefs || []);
        for (const r of dupe.scriptureRefs) {
          if (!existing.has(r)) {
            scriptureRefsMoved++;
            existing.add(r);
          }
        }
        target.scriptureRefs = [...existing];
      }

      if (movedCats.length > 0) {
        log.push(`  ← [${dupe.id}] merged: ${movedCats.join(", ")}`);
      } else {
        log.push(`  ← [${dupe.id}] (catalogs already present, removing dupe)`);
      }

      idsToRemove.add(dupe.id);
    }

    mergedGroups++;
    mergeLog.push(...log);
  }

  // Remove merged duplicates
  const newLibrary = library.filter((s) => !idsToRemove.has(s.id));
  const removed = library.length - newLibrary.length;

  if (!DRY_RUN) {
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(newLibrary, null, 2));
    console.log(`\nWrote ${newLibrary.length} songs to song-library.json`);
  }

  console.log(`\n=== Results ===`);
  console.log(`Title groups merged: ${mergedGroups}`);
  console.log(`Catalog entries moved: ${catalogsMoved}`);
  console.log(`Topics moved: ${topicsMoved}`);
  console.log(`Scripture refs moved: ${scriptureRefsMoved}`);
  console.log(`Duplicate entries removed: ${removed}`);
  console.log(`Library: ${library.length} → ${newLibrary.length} songs`);

  if (mergeLog.length > 0) {
    console.log(`\n--- Merge Details ---`);
    const limit = DRY_RUN ? mergeLog.length : 30;
    for (const line of mergeLog.slice(0, limit)) console.log(line);
    if (mergeLog.length > limit)
      console.log(`  ... and ${mergeLog.length - limit} more lines`);
  }
}

main();
