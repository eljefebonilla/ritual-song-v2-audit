/**
 * build-date-index.ts
 *
 * Reads all occasion JSON files from src/data/occasions/,
 * extracts every date entry, and writes a flat date-index.json
 * mapping dates to occasion info. Avoids loading all occasion
 * files client-side.
 *
 * Usage: npx tsx scripts/build-date-index.ts
 */

import fs from "fs";
import path from "path";

interface OccasionDate {
  date: string;
  label: string;
  dayOfWeek: string;
}

interface OccasionFile {
  id: string;
  name: string;
  season: string;
  dates: OccasionDate[];
}

interface DateIndexEntry {
  date: string;
  occasionId: string;
  season: string;
  name: string;
}

const OCCASIONS_DIR = path.join(__dirname, "../src/data/occasions");
const OUTPUT_PATH = path.join(__dirname, "../src/data/date-index.json");

function main() {
  const files = fs.readdirSync(OCCASIONS_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} occasion files`);

  const seen = new Map<string, DateIndexEntry>();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(OCCASIONS_DIR, file), "utf-8");
    const occasion: OccasionFile = JSON.parse(raw);

    for (const d of occasion.dates) {
      // First occasion wins on collision
      if (!seen.has(d.date)) {
        seen.set(d.date, {
          date: d.date,
          occasionId: occasion.id,
          season: occasion.season,
          name: occasion.name,
        });
      }
    }
  }

  const entries = Array.from(seen.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(entries, null, 2), "utf-8");
  console.log(`Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
  console.log(`File size: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)}KB`);
}

main();
