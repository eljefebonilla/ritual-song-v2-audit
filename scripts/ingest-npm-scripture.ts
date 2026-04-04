/**
 * Ingest NPM Liturgy Help scripture-based music recommendations.
 * Parses scraped JSON → matches songs → inserts into scripture_song_mappings.
 *
 * Usage:
 *   npx tsx scripts/ingest-npm-scripture.ts                  # dry-run
 *   npx tsx scripts/ingest-npm-scripture.ts --execute        # insert into Supabase
 *   npx tsx scripts/ingest-npm-scripture.ts --execute --clear # clear + re-insert
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// ----- Config -----

const SCRAPED_FILE = path.join(
  process.env.HOME || "",
  "Desktop",
  "Scraping ",
  "all_sundays_scripture_music.json"
);

const ALL_OCCASIONS_FILE = path.join(
  __dirname,
  "..",
  "src",
  "data",
  "all-occasions.json"
);

const isDryRun = !process.argv.includes("--execute");
const doClear = process.argv.includes("--clear");

// ----- Types -----

interface ScrapedEntry {
  year: string;
  date: string;
  occasion: string;
  music: string;
  ud?: string;
  num?: number;
}

interface ParsedSong {
  title: string;
  codes: string;
}

interface ParsedReading {
  type: string;
  reference: string;
  text: string;
  songs: ParsedSong[];
}

interface Mapping {
  occasion_id: string;
  reading_type: string;
  reading_reference: string | null;
  reading_text: string | null;
  song_title: string;
  song_codes: string;
  song_id: string | null;
  match_method: string | null;
}

// ----- NPM Occasion Name to Our Occasion ID -----

const ordinalMap: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14,
  fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20,
  "twenty-first": 21, "twenty-second": 22, "twenty-third": 23,
  "twenty-fourth": 24, "twenty-fifth": 25, "twenty-sixth": 26,
  "twenty-seventh": 27, "twenty-eighth": 28, "twenty-ninth": 29,
  thirtieth: 30, "thirty-first": 31, "thirty-second": 32,
  "thirty-third": 33, "thirty-fourth": 34,
};

function npmNameToOccasionId(name: string, yearCycle: string): string | null {
  const lower = name.toLowerCase().trim();
  const yr = yearCycle.toLowerCase();

  // Advent
  const adventMatch = lower.match(/^(\w+(?:-\w+)?)\s+sunday\s+of\s+advent/);
  if (adventMatch) {
    const num = ordinalMap[adventMatch[1]];
    if (num) return `advent-${String(num).padStart(2, "0")}-${yr}`;
  }

  // Lent
  const lentMatch = lower.match(/^(\w+(?:-\w+)?)\s+sunday\s+of\s+lent/);
  if (lentMatch) {
    const num = ordinalMap[lentMatch[1]];
    if (num) return `lent-${String(num).padStart(2, "0")}-${yr}`;
  }

  // Easter (02 = Divine Mercy Sunday)
  const easterSunMatch = lower.match(
    /^(\w+(?:-\w+)?)\s+sunday\s+of\s+easter/
  );
  if (easterSunMatch) {
    const num = ordinalMap[easterSunMatch[1]];
    if (num === 2) return `easter-02-divine-mercy-${yr}`;
    if (num) return `easter-${String(num).padStart(2, "0")}-${yr}`;
  }

  // Ordinary Time: ordinary-time-NN-x (with special suffix for OT 03)
  const otMatch = lower.match(
    /^(\w+(?:-\w+)?)\s+sunday\s+in\s+ordinary\s+time/
  );
  if (otMatch) {
    const num = ordinalMap[otMatch[1]];
    if (num === 3) return `ordinary-time-03-${yr}-word-of-god-sunday`;
    if (num) return `ordinary-time-${String(num).padStart(2, "0")}-${yr}`;
  }

  // Easter Sunday (ABC, not per-year)
  if (lower.includes("easter sunday")) return "easter-sunday-abc";

  // Palm Sunday
  if (lower.includes("palm sunday")) return `palm-sunday-${yr}`;

  // Pentecost
  if (lower.includes("pentecost")) return `pentecost-${yr}`;

  // Ascension
  if (lower.includes("ascension")) return `ascension-${yr}`;

  // Holy Trinity
  if (lower.includes("most holy trinity"))
    return `solemnity-most-holy-trinity-${yr}`;

  // Body and Blood (Corpus Christi)
  if (lower.includes("body and blood"))
    return `solemnity-body-blood-of-christ-${yr}`;

  // Christ the King
  if (lower.includes("king of the universe"))
    return `solemnity-christ-the-king-${yr}`;

  // Holy Family
  if (lower.includes("holy family")) return `holy-family-${yr}`;

  // Epiphany
  if (lower.includes("epiphany")) return "the-epiphany-of-the-lord-abc";

  // Baptism of the Lord
  if (lower.includes("baptism of the lord"))
    return `baptism-of-the-lord-${yr}`;

  // All Saints
  if (lower.includes("all saints")) return "solemnity-nov-1-all-saints-abc";

  // Assumption
  if (lower.includes("assumption"))
    return "solemnity-assumption-abc";

  // Transfiguration
  if (lower.includes("transfiguration"))
    return "feast-transfiguration-abc";

  return null;
}

// ----- Parse Music Text -----

function parseMusicText(rawText: string): ParsedReading[] {
  if (!rawText || rawText.length < 50) return [];

  // Remove header
  let text = rawText;
  const headerEnd = text.indexOf("\n\nEntrance Antiphon");
  if (headerEnd < 0) {
    const altEnd = text.indexOf("\n\nFirst Reading");
    if (altEnd < 0) return [];
    text = text.substring(altEnd);
  } else {
    text = text.substring(headerEnd);
  }

  // Split into sections by reading type headers
  const sectionPattern =
    /\n\n(Entrance Antiphon|First Reading|Second Reading|Sequence|Gospel Acclamation|Gospel|Communion Antiphon)\n/g;
  const sections: { type: string; content: string }[] = [];
  let lastIndex = 0;
  let lastType = "";
  let match;

  while ((match = sectionPattern.exec(text)) !== null) {
    if (lastType) {
      sections.push({
        type: lastType,
        content: text.substring(lastIndex, match.index).trim(),
      });
    }
    lastType = match[1];
    lastIndex = match.index + match[0].length;
  }
  if (lastType) {
    sections.push({
      type: lastType,
      content: text.substring(lastIndex).trim(),
    });
  }

  const readings: ParsedReading[] = [];

  for (const section of sections) {
    // Skip Gospel Acclamation (not a reading with meaningful song recs)
    if (section.type === "Gospel Acclamation") continue;

    const readingType = section.type
      .toLowerCase()
      .replace(/ /g, "_");

    // Split content by "Add to Clipboard" to find songs
    const parts = section.content.split(/\s*Add to Clipboard\s*\n\n/);

    // First part is scripture reference + text
    const scriptureBlock = parts[0] || "";
    const scriptureLines = scriptureBlock
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);

    let reference = "";
    let readingText = "";

    if (scriptureLines.length >= 1) {
      reference = scriptureLines[0];
      if (scriptureLines.length >= 2) {
        readingText = scriptureLines.slice(1).join("\n");
      }
    }

    // Parse songs from remaining parts
    const songs: ParsedSong[] = [];
    for (let i = 1; i < parts.length; i++) {
      const songBlock = parts[i].trim();
      const songLines = songBlock
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean);

      if (songLines.length >= 2) {
        const title = songLines[0]
          .replace(/\s+$/, "")
          .replace(/\s{2,}/g, " ");
        const codes = songLines[1].replace(/\u00a0/g, " ").trim();

        // Skip if codes look like a section header
        if (
          codes.match(/^(or|At an|Entrance|First|Second|Gospel|Communion)/i)
        )
          continue;

        songs.push({ title, codes });
      } else if (songLines.length === 1) {
        songs.push({ title: songLines[0], codes: "" });
      }
    }

    readings.push({
      type: readingType,
      reference,
      text: readingText,
      songs,
    });
  }

  return readings;
}

// ----- Song Matching -----

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/["\u201C\u201D]/g, '"')
    .replace(/[^\w\s'"-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTitleIndex(
  songs: Array<{ id: string; title: string }>
): Map<string, string> {
  const index = new Map<string, string>();
  for (const song of songs) {
    index.set(normalizeTitle(song.title), song.id);
  }
  return index;
}

function matchSong(
  npmTitle: string,
  titleIndex: Map<string, string>
): { songId: string; method: string } | null {
  const normalized = normalizeTitle(npmTitle);

  // Exact match
  const exactId = titleIndex.get(normalized);
  if (exactId) return { songId: exactId, method: "exact_title" };

  // Try without parenthetical suffixes
  const withoutParens = normalized.replace(/\s*\(.*\)\s*$/, "").trim();
  if (withoutParens !== normalized) {
    const id = titleIndex.get(withoutParens);
    if (id) return { songId: id, method: "fuzzy_title" };
  }

  // Try without leading articles
  const withoutArticle = normalized
    .replace(/^(the|a|an|o|oh)\s+/, "")
    .trim();
  if (withoutArticle !== normalized) {
    const id = titleIndex.get(withoutArticle);
    if (id) return { songId: id, method: "fuzzy_title" };
  }

  // Prefix match (NPM titles sometimes have extra qualifiers)
  for (const [libTitle, libId] of titleIndex) {
    if (
      libTitle.length > 8 &&
      (normalized.startsWith(libTitle) || libTitle.startsWith(normalized))
    ) {
      return { songId: libId, method: "fuzzy_title" };
    }
  }

  return null;
}

// ----- Main -----

async function main() {
  console.log(isDryRun ? "=== DRY RUN ===" : "=== EXECUTING ===");

  // Load scraped data
  console.log(`Loading scraped data from ${SCRAPED_FILE}...`);
  const scraped: ScrapedEntry[] = JSON.parse(
    fs.readFileSync(SCRAPED_FILE, "utf-8")
  );
  console.log(`  ${scraped.length} entries loaded`);

  // Load occasion index for validation
  const allOccasions = JSON.parse(
    fs.readFileSync(ALL_OCCASIONS_FILE, "utf-8")
  ) as Array<{ id: string; name: string; year: string }>;
  const validOccasionIds = new Set(allOccasions.map((o: { id: string }) => o.id));
  console.log(`  ${validOccasionIds.size} valid occasion IDs`);

  // Load song library for title matching
  const songLibrary = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "src", "data", "song-library.json"),
      "utf-8"
    )
  ) as Array<{ id: string; title: string }>;
  const titleIndex = buildTitleIndex(songLibrary);
  console.log(`  ${titleIndex.size} songs indexed for title matching`);

  // Process all entries
  const mappings: Mapping[] = [];
  const stats = {
    entries: 0,
    parsed: 0,
    songs: 0,
    matched: 0,
    unmatched: 0,
    unknownOccasions: new Set<string>(),
    matchedOccasions: new Set<string>(),
    validatedOccasions: new Set<string>(),
  };

  for (const entry of scraped) {
    stats.entries++;
    if (!entry.music || entry.music.length < 50) continue;

    const occasionId = npmNameToOccasionId(entry.occasion, entry.year);
    if (!occasionId) {
      stats.unknownOccasions.add(`${entry.year}: ${entry.occasion}`);
      continue;
    }

    stats.matchedOccasions.add(occasionId);
    if (validOccasionIds.has(occasionId)) {
      stats.validatedOccasions.add(occasionId);
    }

    const readings = parseMusicText(entry.music);
    if (readings.length === 0) continue;
    stats.parsed++;

    for (const reading of readings) {
      for (const song of reading.songs) {
        stats.songs++;
        const songMatch = matchSong(song.title, titleIndex);

        mappings.push({
          occasion_id: occasionId,
          reading_type: reading.type,
          reading_reference: reading.reference || null,
          reading_text: reading.text || null,
          song_title: song.title,
          song_codes: song.codes,
          song_id: songMatch?.songId || null,
          match_method: songMatch?.method || null,
        });

        if (songMatch) stats.matched++;
        else stats.unmatched++;
      }
    }
  }

  // Deduplicate (same occasion + reading_type + song_title)
  const seen = new Set<string>();
  const deduped = mappings.filter((m) => {
    const key = `${m.occasion_id}|${m.reading_type}|${m.song_title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const dupeCount = mappings.length - deduped.length;

  // Report
  console.log("\n=== RESULTS ===");
  console.log(`Entries processed: ${stats.entries}`);
  console.log(`Entries with parseable music: ${stats.parsed}`);
  console.log(`Total song mappings: ${mappings.length} (${dupeCount} duplicates removed = ${deduped.length} unique)`);
  console.log(
    `Songs matched to library: ${stats.matched} (${((stats.matched / stats.songs) * 100).toFixed(1)}%)`
  );
  console.log(`Songs unmatched: ${stats.unmatched}`);
  console.log(`\nOccasion mapping: ${stats.matchedOccasions.size} NPM occasions mapped`);
  console.log(`  Valid in our system: ${stats.validatedOccasions.size}`);

  if (stats.unknownOccasions.size > 0) {
    console.log(
      `\nUnmapped NPM occasion names (${stats.unknownOccasions.size}):`
    );
    for (const name of stats.unknownOccasions) {
      console.log(`  ${name}`);
    }
  }

  // Show sample
  console.log("\nSample matched mappings:");
  const sample = deduped.filter((m) => m.song_id).slice(0, 8);
  for (const m of sample) {
    console.log(
      `  ${m.occasion_id.padEnd(30)} ${m.reading_type.padEnd(20)} ${m.song_title.substring(0, 30).padEnd(32)} [${m.match_method}]`
    );
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] No data inserted. Use --execute to insert.");
    fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
    const outFile = path.join(__dirname, "data", "scripture-mappings-preview.json");
    fs.writeFileSync(outFile, JSON.stringify(deduped.slice(0, 200), null, 2));
    console.log(`Preview saved to ${outFile}`);
    return;
  }

  // Insert into Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Resolve legacy string IDs to UUIDs (song_id column is UUID)
  const legacyIds = [...new Set(deduped.filter((m) => m.song_id).map((m) => m.song_id!))];
  console.log(`\nResolving ${legacyIds.length} legacy IDs to UUIDs...`);
  const legacyToUuid = new Map<string, string>();
  const resolvePageSize = 500;
  for (let i = 0; i < legacyIds.length; i += resolvePageSize) {
    const batch = legacyIds.slice(i, i + resolvePageSize);
    const { data } = await supabase
      .from("songs")
      .select("id, legacy_id")
      .in("legacy_id", batch);
    for (const row of data || []) {
      legacyToUuid.set(row.legacy_id, row.id);
    }
  }
  console.log(`  Resolved ${legacyToUuid.size} / ${legacyIds.length} UUIDs`);

  // Replace legacy IDs with UUIDs in mappings
  for (const m of deduped) {
    if (m.song_id) {
      const uuid = legacyToUuid.get(m.song_id);
      if (uuid) {
        m.song_id = uuid;
      } else {
        m.song_id = null;
        m.match_method = null;
      }
    }
  }

  if (doClear) {
    console.log("\nClearing existing scripture_song_mappings...");
    const { error: delErr } = await supabase
      .from("scripture_song_mappings")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) console.error("Delete error:", delErr.message);
    else console.log("  Cleared.");
  }

  // Batch insert
  console.log(`\nInserting ${deduped.length} mappings...`);
  const batchSize = 250;
  let inserted = 0;
  let batchErrors = 0;

  for (let i = 0; i < deduped.length; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize);
    const { error } = await supabase
      .from("scripture_song_mappings")
      .insert(batch);

    if (error) {
      console.error(
        `  Batch ${Math.floor(i / batchSize) + 1} error: ${error.message}`
      );
      batchErrors++;
    } else {
      inserted += batch.length;
    }

    if ((i + batchSize) % 1000 === 0) {
      console.log(`  ${inserted} inserted...`);
    }
  }

  console.log(`\nInserted: ${inserted} mappings`);
  if (batchErrors) console.log(`Batch errors: ${batchErrors}`);
  console.log("Done.");
}

main().catch(console.error);
