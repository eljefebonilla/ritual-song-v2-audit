/**
 * Song Form Analysis Script
 *
 * Uses OpenRouter AI to analyze lyrics and determine song structure.
 * Writes results to songs.song_form JSONB column.
 *
 * Usage:
 *   npx tsx scripts/analyze-song-forms.ts [--execute] [--limit 100]
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENROUTER_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 100;
const offsetIdx = args.indexOf("--offset");
const offset = offsetIdx >= 0 ? parseInt(args[offsetIdx + 1], 10) : 0;

interface SongWithLyrics {
  id: string;
  legacy_id: string;
  title: string;
  composer: string | null;
  category: string;
  lyrics_url: string;
}

async function fetchSongsNeedingAnalysis(): Promise<SongWithLyrics[]> {
  // Find songs that have lyrics resources but no song_form
  const { data, error } = await supabase
    .from("song_resources_v2")
    .select("song_id, url, storage_path")
    .eq("type", "lyrics")
    .not("url", "is", null)
    .order("created_at", { ascending: true })
    .range(0, 2000);

  if (error || !data) {
    console.error("Error fetching lyrics resources:", error?.message);
    return [];
  }

  // Get unique song IDs that don't have song_form yet
  const songIds = [...new Set(data.map(r => r.song_id))];

  const { data: songs, error: songErr } = await supabase
    .from("songs")
    .select("id, legacy_id, title, composer, category")
    .in("id", songIds)
    .is("song_form", null)
    .order("usage_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (songErr || !songs) {
    console.error("Error fetching songs:", songErr?.message);
    return [];
  }

  // Map song to its first lyrics resource
  const lyricsMap = new Map<string, string>();
  for (const r of data) {
    if (!lyricsMap.has(r.song_id) && r.url?.endsWith(".txt")) {
      lyricsMap.set(r.song_id, r.url);
    }
  }

  return songs
    .filter(s => lyricsMap.has(s.id))
    .map(s => ({
      ...s,
      lyrics_url: lyricsMap.get(s.id)!,
    })) as SongWithLyrics[];
}

async function fetchLyrics(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    return text.trim().slice(0, 3000); // Cap at 3000 chars
  } catch {
    return null;
  }
}

async function analyzeSongForm(song: SongWithLyrics, lyrics: string): Promise<Record<string, unknown> | null> {
  const prompt = `Analyze the structure/form of this Catholic liturgical song. Identify sections (verse, refrain/chorus, bridge, coda, intro, etc.) and whether any sections are suitable for solo voice vs. full assembly/choir.

Title: "${song.title}"
Composer: ${song.composer || "Unknown"}
Category: ${song.category}

Lyrics:
${lyrics}

Return JSON only:
{
  "form": "verse-refrain" | "through-composed" | "strophic" | "AABA" | "responsorial" | "litany" | "other",
  "sections": [
    { "type": "refrain"|"verse"|"bridge"|"coda"|"intro"|"pre-chorus"|"interlude", "label": "Refrain" | "Verse 1" | etc., "soloSuitable": true|false }
  ],
  "totalSections": 8,
  "hasSoloOpportunity": true|false,
  "soloSections": ["Verse 1", "Bridge"],
  "assemblyParts": ["Refrain"],
  "notes": "Brief note about the form"
}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You analyze Catholic hymn and liturgical song structures. Return ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    console.error(`  OpenRouter error: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return null;

  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error(`  Failed to parse: ${text.slice(0, 200)}`);
    return null;
  }
}

async function main() {
  console.log(`Song Form Analysis ${execute ? "(EXECUTE)" : "(DRY RUN)"}`);
  console.log(`Limit: ${limit}, Offset: ${offset}\n`);

  const songs = await fetchSongsNeedingAnalysis();
  console.log(`Found ${songs.length} songs with lyrics needing form analysis\n`);

  let analyzed = 0;
  let failed = 0;
  let noLyrics = 0;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    console.log(`[${i + 1}/${songs.length}] ${song.title} — ${song.composer || "?"}`);

    const lyrics = await fetchLyrics(song.lyrics_url);
    if (!lyrics || lyrics.length < 20) {
      console.log("  -> No usable lyrics");
      noLyrics++;
      continue;
    }

    const form = await analyzeSongForm(song, lyrics);
    if (!form) {
      console.log("  -> Analysis failed");
      failed++;
      continue;
    }

    console.log(`  -> ${form.form} | Solo: ${form.hasSoloOpportunity} | Sections: ${form.totalSections}`);

    if (execute) {
      const { error } = await supabase
        .from("songs")
        .update({ song_form: form })
        .eq("id", song.id);
      if (error) {
        console.log(`  -> DB write failed: ${error.message}`);
        failed++;
      } else {
        console.log("  -> Saved");
        analyzed++;
      }
    } else {
      console.log("  -> Would save (dry run)");
      analyzed++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  console.log("\n--- Summary ---");
  console.log(`Analyzed: ${analyzed}`);
  console.log(`Failed: ${failed}`);
  console.log(`No lyrics: ${noLyrics}`);
  console.log(`Total: ${songs.length}`);
}

main().catch(console.error);
