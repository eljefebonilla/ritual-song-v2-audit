/**
 * Pre-compute song recommendations for all occasions.
 * Priority: Lent/Easter first, then Advent/Christmas, then Ordinary Time.
 *
 * Usage: npx tsx scripts/seed-recommendations.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";

// Load occasion and song data
const allOccasionsData = require("../src/data/all-occasions.json") as { id: string; season: string }[];

function getOccasion(id: string) {
  try {
    return require(`../src/data/occasions/${id}.json`);
  } catch {
    return null;
  }
}

// Inline a simplified version of the recommendation engine to avoid TS import issues
interface Reading {
  type: string;
  citation: string;
  summary: string;
}

interface LibrarySong {
  id: string;
  title: string;
  composer?: string;
  category?: string;
  functions?: string[];
  topics?: string[];
  scriptureRefs?: string[];
  liturgicalUse?: string[];
  catalogs?: { bb2026?: number };
  usageCount: number;
  occasions: string[];
  isHiddenGlobal?: boolean;
  resources: unknown[];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POSITION_FUNCTION_MAP: Record<string, string[]> = {
  gathering: ["gathering", "entrance"],
  offertory: ["offertory", "preparation_of_gifts"],
  communion1: ["communion"],
  communion2: ["communion"],
  sending: ["sending", "recessional", "closing"],
  prelude: ["prelude", "gathering", "meditation"],
  psalm: ["psalm", "responsorial"],
  gospelAcclamation: ["gospel_acclamation"],
};

const SEASON_TAGS: Record<string, string[]> = {
  advent: ["advent"],
  christmas: ["christmas", "nativity"],
  lent: ["lent", "lenten"],
  easter: ["easter", "paschal"],
  ordinary: ["ordinary time", "ordinary"],
};

function parseCitation(citation: string): { book: string; chapter: number } | null {
  const m = citation.match(/^(\d?\s*[A-Za-z]+)\s+(\d+)/);
  if (!m) return null;
  return { book: m[1].replace(/\s+/g, "").toLowerCase(), chapter: parseInt(m[2], 10) };
}

function scriptureMatch(songRef: string, readingCitation: string): boolean {
  const s = parseCitation(songRef);
  const r = parseCitation(readingCitation);
  if (!s || !r) return false;
  const norm = (b: string) =>
    b.replace(/^matt?$/, "mt").replace(/^mark$/, "mk").replace(/^luke$/, "lk").replace(/^john$/, "jn");
  return norm(s.book) === norm(r.book) && s.chapter === r.chapter;
}

function extractThemes(readings: Reading[]): string[] {
  const themes: string[] = [];
  const allText = readings.map((r) => r.summary?.toLowerCase() || "").join(" ");
  const patterns: [RegExp, string][] = [
    [/\b(mercy|merciful|compassion)\b/, "mercy"],
    [/\b(forgiv|pardon|reconcil)\b/, "forgiveness"],
    [/\b(love|charity|agape)\b/, "love"],
    [/\b(hope|trust)\b/, "hope"],
    [/\b(faith|believ)\b/, "faith"],
    [/\b(joy|rejoic)\b/, "joy"],
    [/\b(peace)\b/, "peace"],
    [/\b(light|illumin)\b/, "light"],
    [/\b(water|bapti|thirst)\b/, "water/baptism"],
    [/\b(bread|eucharist|nourish|feed)\b/, "eucharist"],
    [/\b(shepherd|sheep|flock)\b/, "shepherd"],
    [/\b(cross|suffer|passion|death)\b/, "suffering/cross"],
    [/\b(resurrect|risen|rise|eternal life)\b/, "resurrection"],
    [/\b(spirit|holy spirit)\b/, "holy spirit"],
    [/\b(kingdom|reign)\b/, "kingdom"],
    [/\b(servant|service)\b/, "service"],
    [/\b(justice|righteous)\b/, "justice"],
    [/\b(pray|prayer)\b/, "prayer"],
    [/\b(communit|gather|church|unity)\b/, "community"],
    [/\b(praise|worship|glory)\b/, "praise"],
    [/\b(lent|penanc|repent|convert)\b/, "repentance"],
    [/\b(heal|cure|restor)\b/, "healing"],
    [/\b(pilgrim|journey|way|path)\b/, "journey"],
    [/\b(covenant|promis)\b/, "covenant"],
    [/\b(creation|creat)\b/, "creation"],
    [/\b(mission|send|go forth)\b/, "mission"],
  ];
  for (const [pat, theme] of patterns) {
    if (pat.test(allText)) themes.push(theme);
  }
  return themes;
}

function getEligibleCategories(position: string): Set<string> | null {
  switch (position) {
    case "gathering": case "offertory": case "communion1": case "communion2": case "sending": case "prelude":
      return new Set(["song"]);
    case "psalm":
      return new Set(["psalm"]);
    case "gospelAcclamation":
      return new Set(["gospel_acclamation_refrain", "gospel_acclamation_verse", "gospel_acclamation"]);
    default: return null;
  }
}

function recommendSongs(
  occasion: { season: string; seasonLabel: string; lectionary: { thematicTag?: string }; readings: Reading[]; id: string },
  position: string,
  allSongs: LibrarySong[],
  limit = 10
): { songId: string; score: number; reasons: string[] }[] {
  const readingCitations = (occasion.readings || []).filter((r: Reading) => r.citation).map((r: Reading) => r.citation);
  const readingThemes = extractThemes(occasion.readings || []);
  const thematicTag = occasion.lectionary?.thematicTag?.toLowerCase() || "";
  const seasonTags = SEASON_TAGS[occasion.season] || [];
  const positionFunctions = POSITION_FUNCTION_MAP[position] || [];
  const eligibleCategories = getEligibleCategories(position);

  const scored: { songId: string; score: number; reasons: string[] }[] = [];

  for (const song of allSongs) {
    if (song.isHiddenGlobal) continue;
    if (eligibleCategories && song.category && !eligibleCategories.has(song.category)) continue;

    let score = 0;
    const reasons: string[] = [];

    // Scripture match
    if (song.scriptureRefs?.length) {
      for (const ref of song.scriptureRefs) {
        for (const cit of readingCitations) {
          if (scriptureMatch(ref, cit)) { score += 30; reasons.push(`Scripture: ${ref}`); break; }
        }
      }
    }

    // Topic match
    let topicScore = 0;
    if (song.topics?.length) {
      const st = song.topics.map((t) => t.toLowerCase());
      for (const theme of readingThemes) {
        if (st.some((t) => t.includes(theme) || theme.includes(t))) { topicScore += 20; reasons.push(`Topic: ${theme}`); }
      }
      if (thematicTag) {
        const tw = thematicTag.split(/\s+/);
        for (const w of tw) {
          if (w.length > 3 && st.some((t) => t.includes(w))) { topicScore += 15; reasons.push(`Theme: ${occasion.lectionary.thematicTag}`); break; }
        }
      }
    }
    score += Math.min(topicScore, 60);

    // Season match
    if (song.liturgicalUse?.length) {
      const su = song.liturgicalUse.map((u) => u.toLowerCase());
      for (const tag of seasonTags) {
        if (su.some((u) => u.includes(tag))) { score += 15; reasons.push(`Season: ${occasion.seasonLabel}`); break; }
      }
    }

    // Function match
    if (song.functions?.length) {
      const sf = song.functions.map((f) => f.toLowerCase());
      for (const fn of positionFunctions) {
        if (sf.some((s) => s.includes(fn) || fn.includes(s))) { score += 25; reasons.push(`Function: ${fn}`); break; }
      }
    }

    // Catalog presence
    if (song.catalogs?.bb2026) { score += 5; reasons.push("BB2026"); }

    // Usage
    const u = song.usageCount || 0;
    if (u >= 5 && u <= 50) score += 10;
    else if (u >= 1 && u <= 4) score += 5;
    else if (u > 100) score -= 5;

    if (score >= 10) {
      scored.push({ songId: song.id, score, reasons: [...new Set(reasons)] });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

async function main() {
  console.log("Loading song library from JSON...");
  const songs: LibrarySong[] = require("../src/data/song-library.json");
  console.log(`Loaded ${songs.length} songs`);

  // Build UUID lookup
  console.log("Fetching song UUIDs from Supabase...");
  const songUuidMap = new Map<string, string>();
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) { console.error("Error fetching songs:", error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      songUuidMap.set(row.legacy_id, row.id);
    }
    page++;
  }
  console.log(`Mapped ${songUuidMap.size} song UUIDs`);

  // Clear existing recommendations
  console.log("Clearing existing recommendations...");
  await supabase.from("song_recommendations").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Prioritize seasons: lent, easter, advent, christmas, then rest
  const seasonPriority: Record<string, number> = {
    lent: 0, easter: 1, advent: 2, christmas: 3,
    ordinary: 4, solemnity: 5, feast: 6,
  };

  const sorted = [...allOccasionsData].sort((a, b) => {
    const pa = seasonPriority[a.season] ?? 99;
    const pb = seasonPriority[b.season] ?? 99;
    return pa - pb;
  });

  const positions = ["gathering", "offertory", "communion1", "sending", "prelude", "psalm", "gospelAcclamation"];
  let totalInserted = 0;
  let occasionCount = 0;

  for (const occ of sorted) {
    const fullOccasion = getOccasion(occ.id);
    if (!fullOccasion) continue;

    const batch: {
      occasion_id: string;
      position: string;
      song_id: string;
      score: number;
      match_reasons: string[];
    }[] = [];

    for (const pos of positions) {
      const recs = recommendSongs(fullOccasion, pos, songs, 10);
      for (const rec of recs) {
        const uuid = songUuidMap.get(rec.songId);
        if (!uuid) continue;
        batch.push({
          occasion_id: occ.id,
          position: pos,
          song_id: uuid,
          score: rec.score,
          match_reasons: rec.reasons,
        });
      }
    }

    if (batch.length > 0) {
      const { error } = await supabase.from("song_recommendations").insert(batch);
      if (error) {
        console.error(`Error inserting recs for ${occ.id}:`, error.message);
      } else {
        totalInserted += batch.length;
      }
    }

    occasionCount++;
    if (occasionCount % 20 === 0) {
      console.log(`Processed ${occasionCount} occasions, ${totalInserted} recommendations so far...`);
      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\nDone! Seeded ${totalInserted} recommendations across ${occasionCount} occasions.`);
}

main().catch(console.error);
