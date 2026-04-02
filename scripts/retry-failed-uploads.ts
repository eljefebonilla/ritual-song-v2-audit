/**
 * Retry failed OCP uploads by comparing what's in Supabase Storage
 * vs what should be there. Uploads any missing files.
 *
 * Usage: npx tsx scripts/retry-failed-uploads.ts
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");
const BUCKET = "song-resources";

interface Song {
  id: string;
  title: string;
  composer?: string;
  [key: string]: unknown;
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".pdf": "application/pdf",
    ".gif": "image/gif",
    ".txt": "text/plain",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

async function main() {
  // Get all song_resources_v2 rows (what we have)
  console.log("Loading existing resources from DB...");
  const existingPaths = new Set<string>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("song_resources_v2")
      .select("storage_path")
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      if (row.storage_path) existingPaths.add(row.storage_path);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`  ${existingPaths.size} resources already in DB`);

  // Load song library for UUID lookup
  const songs: Song[] = JSON.parse(fs.readFileSync(SONG_LIBRARY_PATH, "utf-8"));
  const uuidMap = new Map<string, string>();
  let off2 = 0;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id")
      .range(off2, off2 + 999);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      if (row.legacy_id) uuidMap.set(row.legacy_id, row.id);
    }
    if (data.length < 1000) break;
    off2 += 1000;
  }

  // Find missing: check each storage_path pattern we expect
  // Just re-run the import script in dry-run mode and compare
  // Simpler approach: list all folders in storage and find songs with incomplete resource sets

  // Actually, simplest: find audio files that don't have DB entries
  const OCP_DIR = "/Users/jeffreybonilla/Desktop/OCP Fresh Resource Files";
  const FOLDER_MAP: Record<string, string> = {
    "Audio Recordings": "AUDIO",
    "Choral Cantor Sheet Music": "CC",
    "Congregational Sheet Music": "CONG",
    "Congregational Sheet Music GIF": "CONG",
    "Guitar Accompaniment": "GTR",
    "Instrumental Accompaniment": "INST",
    "Keyboard Accompaniment": "KBD",
    "Song Lyrics": "LYR",
  };

  function sanitize(str: string): string {
    return str.replace(/[^\w\s.-]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 120);
  }

  function extractSurname(composer: string): string {
    if (!composer) return "";
    let c = composer
      .replace(/[•–—]/g, ",")
      .replace(/\s*\b(?:Arr\.?(?:anged)?)\b\s*(?:by\s*)?/gi, ",")
      .replace(/\s*\b(?:Adapted)\b\s*(?:by\s*)?/gi, ",")
      .split(",")[0].trim();
    c = c.replace(/\s*,?\s*(?:SJ|CSP|CSSP|OP|DC|OSB|OFM|SM|SS\.CC\.?)\s*$/i, "").trim();
    const parts = c.split(/\s+/);
    return parts.length > 0 ? parts[parts.length - 1] : "";
  }

  // Build quick title→song lookup
  const songByNormTitle = new Map<string, Song>();
  for (const s of songs) {
    const n = s.title.toLowerCase().replace(/[•–—]/g, " ").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
    songByNormTitle.set(n, s);
    songByNormTitle.set(s.title, s);
  }

  let missing = 0;
  let retried = 0;
  let errors = 0;

  for (const [folder, tag] of Object.entries(FOLDER_MAP)) {
    const folderPath = path.join(OCP_DIR, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath).filter(f =>
      fs.statSync(path.join(folderPath, f)).isFile() && !f.startsWith(".")
    );

    for (const fileName of files) {
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const isSS = baseName.endsWith(" (S&S)");
      const ocpTitle = baseName.replace(/ \(S&S\)$/, "");

      // Find the matching song
      const n = ocpTitle.toLowerCase().replace(/[•–—]/g, " ").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
      const song = songByNormTitle.get(ocpTitle) || songByNormTitle.get(n);
      if (!song) continue;

      const surname = extractSurname(song.composer || "");
      let namePart = song.title;
      if (surname) namePart += ` - ${surname}`;
      if (isSS) namePart += " SS";
      const storagePath = `${song.id}/${sanitize(namePart)}_${tag}${ext}`;

      if (existingPaths.has(storagePath)) continue;

      missing++;
      const uuid = uuidMap.get(song.id);
      if (!uuid) {
        errors++;
        continue;
      }

      // Upload
      const buffer = fs.readFileSync(path.join(folderPath, fileName));
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: getMimeType(ext), upsert: true });

      if (uploadError) {
        console.error(`  Upload error: ${storagePath}: ${uploadError.message}`);
        errors++;
        continue;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

      const label = isSS ? `${folder.replace(/ (Recordings|Sheet Music|Accompaniment|GIF)/g, "")} (S&S)` : folder.replace(/ (Recordings|Sheet Music|Accompaniment|GIF)/g, "");
      const type = tag === "AUDIO" ? "audio" : tag === "LYR" ? "lyrics" : "sheet_music";

      const { error: insertError } = await supabase.from("song_resources_v2").insert({
        song_id: uuid,
        type,
        label,
        url: urlData.publicUrl,
        storage_path: storagePath,
        source: "ocp_bb",
        is_highlighted: false,
        tags: [tag],
      });

      if (insertError) {
        console.error(`  DB error: ${insertError.message}`);
        errors++;
        continue;
      }

      retried++;
      if (retried % 10 === 0) process.stdout.write(`  Retried: ${retried}\r`);
    }
  }

  console.log(`\nMissing: ${missing}, Retried: ${retried}, Errors: ${errors}`);

  // Final count
  const { count } = await supabase.from("song_resources_v2").select("*", { count: "exact", head: true });
  console.log(`Total song_resources_v2 rows: ${count}`);
}

main().catch(console.error);
