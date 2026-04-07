/**
 * Missing Audio Enrichment Script
 *
 * Finds high-usage songs with zero audio resources and searches
 * YouTube for official publisher recordings. Prioritizes songs
 * that appear most frequently in music plans.
 *
 * Usage:
 *   npx tsx scripts/enrich-missing-audio.ts --execute --limit 300
 */

import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "child_process";
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
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 300;

interface SongRow {
  id: string;
  title: string;
  composer: string | null;
  category: string;
  usage_count: number;
}

async function fetchSongsWithoutAudio(): Promise<SongRow[]> {
  // Songs with no audio resources AND no youtube_url, ordered by usage
  const { data, error } = await supabase.rpc("songs_without_audio", { lim: limit });

  if (error) {
    // Fallback: manual query
    const { data: songs, error: e2 } = await supabase
      .from("songs")
      .select("id, title, composer, category, usage_count")
      .is("youtube_url", null)
      .gt("usage_count", 0)
      .order("usage_count", { ascending: false })
      .limit(limit);

    if (e2) {
      console.error("Query error:", e2.message);
      return [];
    }

    // Filter out songs that have audio resources
    const songIds = (songs || []).map(s => s.id);
    if (songIds.length === 0) return songs as SongRow[];

    const { data: withAudio } = await supabase
      .from("song_resources_v2")
      .select("song_id")
      .in("song_id", songIds)
      .in("type", ["audio", "practice_track"]);

    const audioSet = new Set((withAudio || []).map(r => r.song_id));
    return (songs || []).filter(s => !audioSet.has(s.id)) as SongRow[];
  }

  return (data || []) as SongRow[];
}

function searchYoutube(query: string, maxResults = 5) {
  try {
    const output = execFileSync("yt-dlp", [
      "--force-ipv4",
      `ytsearch${maxResults}:${query}`,
      "--flat-playlist",
      "--dump-json",
      "--no-warnings",
    ], { timeout: 30000, encoding: "utf8" });

    const results: { id: string; title: string; channel: string; duration: number; url: string }[] = [];
    for (const line of output.trim().split("\n")) {
      if (!line) continue;
      try {
        const j = JSON.parse(line);
        results.push({
          id: j.id,
          title: j.title || "",
          channel: j.channel || j.uploader || "",
          duration: j.duration || 0,
          url: `https://www.youtube.com/watch?v=${j.id}`,
        });
      } catch {}
    }
    return results;
  } catch {
    return [];
  }
}

async function pickBest(song: SongRow, results: { id: string; title: string; channel: string; duration: number; url: string }[]) {
  if (results.length === 0) return null;

  const resultList = results.map((r, i) =>
    `${i + 1}. "${r.title}" by ${r.channel} (${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, "0")})`
  ).join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Pick the best YouTube match for a Catholic hymn. Return ONLY JSON." },
        { role: "user", content: `Song: "${song.title}" by ${song.composer || "Unknown"} (${song.category})\n\nResults:\n${resultList}\n\nReturn: { "pick": 1-5 or 0 if none match, "confidence": "high"|"low", "reason": "..." }` },
      ],
      temperature: 0,
      max_tokens: 150,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text.replace(/```json\s*/g, "").replace(/```/g, "").trim());
    if (parsed.pick > 0 && parsed.pick <= results.length) {
      return { url: results[parsed.pick - 1].url, confidence: parsed.confidence, reason: parsed.reason };
    }
  } catch {}
  return null;
}

async function verifyUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`Missing Audio Enrichment ${execute ? "(EXECUTE)" : "(DRY RUN)"}`);
  console.log(`Limit: ${limit}\n`);

  const songs = await fetchSongsWithoutAudio();
  console.log(`Found ${songs.length} high-usage songs without any audio\n`);

  let approved = 0, queued = 0, notFound = 0, dead = 0;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const query = `${song.title} ${song.composer?.split("•")[0]?.trim() || ""} Catholic hymn`.trim();
    console.log(`[${i + 1}/${songs.length}] (used ${song.usage_count}x) ${song.title}`);

    const results = searchYoutube(query);
    if (results.length === 0) { notFound++; continue; }

    const best = await pickBest(song, results);
    if (!best) { notFound++; continue; }

    const live = await verifyUrl(best.url);
    if (!live) { dead++; continue; }

    console.log(`  -> ${best.url} (${best.confidence})`);

    if (execute) {
      if (best.confidence === "high") {
        await supabase.from("songs").update({
          youtube_url: best.url,
          youtube_url_source: "ai_auto",
          youtube_url_verified_at: new Date().toISOString(),
        }).eq("id", song.id);
        approved++;
      } else {
        await supabase.from("enrichment_queue").insert({
          song_id: song.id,
          task_type: "youtube_link",
          status: "human_review",
          payload: { url: best.url, reason: best.reason },
        });
        queued++;
      }
    } else {
      best.confidence === "high" ? approved++ : queued++;
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log("\n--- Summary ---");
  console.log(`Auto-approved: ${approved}`);
  console.log(`Queued: ${queued}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Dead: ${dead}`);
  console.log(`Total: ${songs.length}`);
}

main().catch(console.error);
