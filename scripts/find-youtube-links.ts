/**
 * AI YouTube Discovery Script
 *
 * 1. Queries songs missing youtube_url
 * 2. Searches YouTube via yt-dlp for real results
 * 3. Uses AI to pick the best match from real results
 * 4. Verifies via oEmbed, then writes to DB or queues for review
 *
 * Usage:
 *   npx tsx scripts/find-youtube-links.ts [--execute] [--limit 50] [--category psalm]
 *
 * Flags:
 *   --execute     Actually write to DB (default: dry run)
 *   --limit N     Process at most N songs (default: 50)
 *   --category X  Filter by song category
 *   --offset N    Skip first N results
 */

import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "child_process";
import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!OPENROUTER_KEY) {
  console.error("Missing OPENROUTER_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 50;
const catIdx = args.indexOf("--category");
const category = catIdx >= 0 ? args[catIdx + 1] : null;
const offsetIdx = args.indexOf("--offset");
const offset = offsetIdx >= 0 ? parseInt(args[offsetIdx + 1], 10) : 0;

interface SongRow {
  id: string;
  legacy_id: string;
  title: string;
  composer: string | null;
  category: string;
  psalm_number: number | null;
}

interface YtResult {
  id: string;
  title: string;
  channel: string;
  duration: number;
  url: string;
}

async function fetchSongsMissingYoutube(): Promise<SongRow[]> {
  let query = supabase
    .from("songs")
    .select("id, legacy_id, title, composer, category, psalm_number")
    .is("youtube_url", null)
    .order("usage_count", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    console.error("Query error:", error.message);
    return [];
  }
  return (data || []) as SongRow[];
}

function buildSearchQuery(song: SongRow): string {
  const parts: string[] = [];

  if (song.category === "psalm" && song.psalm_number) {
    const antiphon = song.title.replace(/^Ps(alm)?\s*\d+\s*/i, "").trim();
    if (song.composer?.includes("Lyric Psalter")) {
      parts.push(`Lyric Psalter Psalm ${song.psalm_number}`);
      if (antiphon) parts.push(antiphon.slice(0, 40));
    } else if (song.composer?.includes("Spirit & Psalm")) {
      parts.push(`Spirit and Psalm Psalm ${song.psalm_number}`);
      if (antiphon) parts.push(antiphon.slice(0, 40));
    } else {
      parts.push(`Psalm ${song.psalm_number} ${antiphon.slice(0, 50)}`);
      if (song.composer) parts.push(song.composer.split("•")[0].trim());
    }
  } else {
    parts.push(song.title);
    if (song.composer) {
      const cleanComposer = song.composer.replace(/\s*[—–•].*/g, "").trim();
      if (cleanComposer && cleanComposer.length < 60) parts.push(cleanComposer);
    }
  }

  parts.push("Catholic hymn");
  return parts.join(" ");
}

function searchYoutube(query: string, maxResults = 5): YtResult[] {
  try {
    const searchTerm = `ytsearch${maxResults}:${query}`;
    const output = execFileSync("yt-dlp", [
      "--force-ipv4",
      searchTerm,
      "--flat-playlist",
      "--dump-json",
      "--no-warnings",
    ], { timeout: 30000, encoding: "utf8" });

    const results: YtResult[] = [];
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  yt-dlp search failed: ${msg.slice(0, 100)}`);
    return [];
  }
}

async function pickBestResult(song: SongRow, results: YtResult[]): Promise<{ url: string; confidence: "high" | "low"; reason: string } | null> {
  if (results.length === 0) return null;
  if (results.length === 1) {
    return { url: results[0].url, confidence: "low", reason: `Only result: "${results[0].title}" by ${results[0].channel}` };
  }

  const resultList = results.map((r, i) =>
    `${i + 1}. "${r.title}" by ${r.channel} (${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, "0")}) — ${r.url}`
  ).join("\n");

  const prompt = `I need the best YouTube video for this Catholic liturgical song:
Title: "${song.title}"
${song.composer ? `Composer: ${song.composer}` : ""}
${song.psalm_number ? `Psalm: ${song.psalm_number}` : ""}
Category: ${song.category}

Here are the real YouTube search results:
${resultList}

Pick the BEST match. Priorities:
1. Official publisher (OCP, GIA, WLP, Liturgical Press, Spirit & Song)
2. Exact title/composer match
3. Congregation/choir recording over solo
4. Reasonable duration (2-8 minutes for hymns, 1-4 for psalm refrains)

Return JSON only: { "pick": 1, "confidence": "high"|"low", "reason": "..." }
"high" = exact match on official channel. "low" = close match or unofficial.
If NONE match, return { "pick": 0, "confidence": "low", "reason": "no good match" }`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You evaluate YouTube search results for Catholic hymns. Return ONLY JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 200,
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
    const parsed = JSON.parse(cleaned);
    const pick = parsed.pick;
    if (pick > 0 && pick <= results.length) {
      return {
        url: results[pick - 1].url,
        confidence: parsed.confidence === "high" ? "high" : "low",
        reason: parsed.reason || "",
      };
    }
  } catch {
    console.error(`  Failed to parse AI response: ${text.slice(0, 200)}`);
  }
  return null;
}

async function verifyYoutubeUrl(url: string): Promise<boolean> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    return res.ok;
  } catch {
    return false;
  }
}

async function writeToDb(songId: string, url: string, source: string): Promise<boolean> {
  const { error } = await supabase
    .from("songs")
    .update({
      youtube_url: url,
      youtube_url_source: source,
      youtube_url_verified_at: new Date().toISOString(),
    })
    .eq("id", songId);
  return !error;
}

async function writeToQueue(songId: string, url: string, reason: string): Promise<boolean> {
  const { error } = await supabase.from("enrichment_queue").insert({
    song_id: songId,
    task_type: "youtube_link",
    status: "human_review",
    payload: { url, reason },
  });
  return !error;
}

async function main() {
  console.log(`YouTube Discovery Script ${execute ? "(EXECUTE)" : "(DRY RUN)"}`);
  console.log(`Limit: ${limit}, Category: ${category || "all"}, Offset: ${offset}\n`);

  const songs = await fetchSongsMissingYoutube();
  console.log(`Found ${songs.length} songs missing YouTube URLs\n`);

  let autoApproved = 0;
  let queued = 0;
  let notFound = 0;
  let deadLinks = 0;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    console.log(`[${i + 1}/${songs.length}] ${song.title} — ${song.composer || "?"}`);

    const query = buildSearchQuery(song);
    console.log(`  Search: "${query}"`);

    const ytResults = searchYoutube(query);
    if (ytResults.length === 0) {
      console.log("  -> No YouTube results");
      notFound++;
      continue;
    }

    console.log(`  -> ${ytResults.length} results found`);
    for (const r of ytResults.slice(0, 3)) {
      console.log(`     "${r.title}" — ${r.channel} (${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, "0")})`);
    }

    const result = await pickBestResult(song, ytResults);
    if (!result) {
      console.log("  -> AI found no good match");
      notFound++;
      continue;
    }

    console.log(`  -> Picked: ${result.url} (${result.confidence}: ${result.reason})`);

    const isLive = await verifyYoutubeUrl(result.url);
    if (!isLive) {
      console.log("  -> DEAD LINK (oEmbed 404)");
      deadLinks++;
      continue;
    }

    if (result.confidence === "high") {
      if (execute) {
        const ok = await writeToDb(song.id, result.url, "ai_auto");
        console.log(`  -> AUTO-APPROVED ${ok ? "OK" : "FAILED"}`);
      } else {
        console.log("  -> Would auto-approve (dry run)");
      }
      autoApproved++;
    } else {
      if (execute) {
        const ok = await writeToQueue(song.id, result.url, result.reason);
        console.log(`  -> QUEUED for review ${ok ? "OK" : "FAILED"}`);
      } else {
        console.log("  -> Would queue for review (dry run)");
      }
      queued++;
    }

    // Rate limit between songs
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n--- Summary ---");
  console.log(`Auto-approved: ${autoApproved}`);
  console.log(`Queued for review: ${queued}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Dead links: ${deadLinks}`);
  console.log(`Total processed: ${songs.length}`);
}

main().catch(console.error);
