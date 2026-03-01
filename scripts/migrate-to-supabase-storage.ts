/**
 * migrate-to-supabase-storage.ts
 *
 * Uploads local files to Supabase Storage and updates song_resources_v2.
 * Resume-capable: skips resources that already have storage_path set.
 *
 * Priority: psalm resources first, then audio, then PDFs, then everything else.
 *
 * Usage: npx tsx scripts/migrate-to-supabase-storage.ts [--priority psalms|audio|pdf|all] [--limit 500]
 */
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MUSIC_DIR = path.join(__dirname, "..", "..", "Song Folders", "Music");
const PSALMS_DIR = path.join(__dirname, "..", "..", "Organized Psalms");

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".txt": "text/plain",
  ".musx": "application/octet-stream",
  ".mxl": "application/vnd.recordare.musicxml",
};

// ── Args ──
const args = process.argv.slice(2);
const priorityArg = args.includes("--priority") ? args[args.indexOf("--priority") + 1] : "all";
const limitArg = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1], 10) : 0;

// ── Report ──
const report = {
  processed: 0,
  uploaded: 0,
  skipped: 0,
  notFound: [] as string[],
  errors: [] as string[],
  totalBytes: 0,
};

function resolveFilePath(filePath: string): string | null {
  // _psalms/ paths → Organized Psalms directory
  if (filePath.startsWith("_psalms/")) {
    const relativePath = filePath.slice("_psalms/".length);
    const fullPath = path.join(PSALMS_DIR, relativePath);
    if (fs.existsSync(fullPath)) return fullPath;
    // Try URL-decoded version
    const decoded = path.join(PSALMS_DIR, decodeURIComponent(relativePath));
    if (fs.existsSync(decoded)) return decoded;
    return null;
  }

  // Regular paths → Music directory
  const fullPath = path.join(MUSIC_DIR, filePath);
  if (fs.existsSync(fullPath)) return fullPath;
  // Try URL-decoded
  const decoded = path.join(MUSIC_DIR, decodeURIComponent(filePath));
  if (fs.existsSync(decoded)) return decoded;
  return null;
}

function sanitizeStoragePath(songLegacyId: string, fileName: string): string {
  // Normalize Unicode to ASCII-safe characters for Supabase Storage
  const safe = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Strip combining diacriticals (é→e, ó→o, etc.)
    .replace(/[#%&{}\[\]\\<>*?/$!'":@+`|=˙]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_") // Strip any remaining non-ASCII
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
  return `${songLegacyId}/${safe}`;
}

async function ensureBucket() {
  // Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === "song-resources");

  if (!exists) {
    console.log("Creating song-resources bucket...");
    const { error } = await supabase.storage.createBucket("song-resources", {
      public: true,
      fileSizeLimit: 104857600, // 100MB
      allowedMimeTypes: Object.values(MIME_TYPES),
    });
    if (error) {
      console.error("Failed to create bucket:", error.message);
      // Might already exist due to race condition
    }
  }
  console.log("Bucket song-resources ready.\n");
}

async function fetchResourcesToMigrate(): Promise<
  Array<{
    id: string;
    song_id: string;
    file_path: string;
    type: string;
    label: string;
    song_legacy_id?: string;
  }>
> {
  // Fetch resources that need migration (no storage_path, has file_path)
  const results: Array<{
    id: string;
    song_id: string;
    file_path: string;
    type: string;
    label: string;
  }> = [];

  let offset = 0;
  while (true) {
    let query = supabase
      .from("song_resources_v2")
      .select("id, song_id, file_path, type, label")
      .is("storage_path", null)
      .not("file_path", "is", null)
      .range(offset, offset + 999);

    // Priority filtering
    if (priorityArg === "psalms") {
      query = query.like("file_path", "_psalms/%");
    } else if (priorityArg === "audio") {
      query = query.in("type", ["audio"]);
    } else if (priorityArg === "pdf") {
      query = query.eq("type", "sheet_music");
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching resources:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  // Apply limit
  if (limitArg > 0) {
    return results.slice(0, limitArg);
  }

  return results;
}

async function getSongLegacyIds(
  songIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  // Batch fetch in chunks of 100
  for (let i = 0; i < songIds.length; i += 100) {
    const chunk = songIds.slice(i, i + 100);
    const { data } = await supabase
      .from("songs")
      .select("id, legacy_id")
      .in("id", chunk);
    for (const s of data || []) {
      map.set(s.id, s.legacy_id);
    }
  }
  return map;
}

async function uploadFile(
  filePath: string,
  storagePath: string,
  contentType: string
): Promise<{ url: string } | { error: string }> {
  const fileBuffer = fs.readFileSync(filePath);

  const { error } = await supabase.storage
    .from("song-resources")
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true, // Allow re-upload on retry
    });

  if (error) {
    return { error: error.message };
  }

  const { data: urlData } = supabase.storage
    .from("song-resources")
    .getPublicUrl(storagePath);

  return { url: urlData.publicUrl };
}

async function main() {
  console.log(`=== Supabase Storage Migration ===`);
  console.log(`Priority: ${priorityArg}`);
  if (limitArg > 0) console.log(`Limit: ${limitArg}`);
  console.log();

  await ensureBucket();

  console.log("Fetching resources to migrate...");
  const resources = await fetchResourcesToMigrate();
  console.log(`Found ${resources.length} resources to migrate.\n`);

  if (resources.length === 0) {
    console.log("Nothing to migrate. All resources have storage_path set.");
    return;
  }

  // Get song legacy IDs for storage paths
  const uniqueSongIds = [...new Set(resources.map((r) => r.song_id))];
  console.log(`Resolving legacy IDs for ${uniqueSongIds.length} songs...`);
  const legacyIdMap = await getSongLegacyIds(uniqueSongIds);

  const startTime = Date.now();
  let lastProgressLog = 0;

  for (let i = 0; i < resources.length; i++) {
    const res = resources[i];
    report.processed++;

    const localPath = resolveFilePath(res.file_path);
    if (!localPath) {
      report.notFound.push(res.file_path);
      report.skipped++;
      continue;
    }

    const stat = fs.statSync(localPath);
    // Skip files larger than 50MB
    if (stat.size > 50 * 1024 * 1024) {
      report.skipped++;
      report.errors.push(`${res.file_path} (too large: ${Math.round(stat.size / 1024 / 1024)}MB)`);
      continue;
    }

    const songLegacyId = legacyIdMap.get(res.song_id) || res.song_id;
    const fileName = path.basename(localPath);
    const storagePath = sanitizeStoragePath(songLegacyId, fileName);
    const ext = path.extname(fileName).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const result = await uploadFile(localPath, storagePath, contentType);

    if ("error" in result) {
      report.errors.push(`${res.file_path}: ${result.error}`);
      // Don't stop on individual errors — continue
      continue;
    }

    // Update the resource row
    const { error: updateError } = await supabase
      .from("song_resources_v2")
      .update({
        storage_path: storagePath,
        url: result.url,
        source: "supabase",
      })
      .eq("id", res.id);

    if (updateError) {
      report.errors.push(`DB update ${res.id}: ${updateError.message}`);
    } else {
      report.uploaded++;
      report.totalBytes += stat.size;
    }

    // Progress logging every 50 files
    if (report.processed - lastProgressLog >= 50) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = report.uploaded / elapsed;
      const remaining = resources.length - i;
      const eta = remaining / rate;
      console.log(
        `  [${report.processed}/${resources.length}] ` +
          `Uploaded: ${report.uploaded} | Skipped: ${report.skipped} | ` +
          `Errors: ${report.errors.length} | ` +
          `${Math.round(report.totalBytes / 1024 / 1024)}MB | ` +
          `${rate.toFixed(1)}/s | ETA: ${Math.round(eta)}s`
      );
      lastProgressLog = report.processed;
    }

    // Rate limiting: small delay every 10 files
    if (i > 0 && i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Larger delay every 100 files
    if (i > 0 && i % 100 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Final report
  const elapsed = (Date.now() - startTime) / 1000;
  console.log("\n=== MIGRATION REPORT ===");
  console.log(`Processed: ${report.processed}/${resources.length}`);
  console.log(`Uploaded: ${report.uploaded}`);
  console.log(`Skipped: ${report.skipped}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log(`Total size: ${Math.round(report.totalBytes / 1024 / 1024)}MB`);
  console.log(`Duration: ${Math.round(elapsed)}s`);
  console.log(`Rate: ${(report.uploaded / elapsed).toFixed(1)} files/s`);

  if (report.notFound.length > 0) {
    console.log(`\n── Files Not Found (${report.notFound.length}) ──`);
    // Write to MISSING-FILES.md
    const missing = report.notFound.map((f) => `- ${f}`).join("\n");
    fs.writeFileSync(
      path.join(__dirname, "..", "MISSING-FILES.md"),
      `# Missing Files\n\nFiles referenced in song_resources_v2 but not found on disk.\n\n${missing}\n`
    );
    console.log("  Written to MISSING-FILES.md");
  }

  if (report.errors.length > 0) {
    console.log(`\n── Errors (${report.errors.length}) ──`);
    for (const e of report.errors.slice(0, 20)) console.log(`  - ${e}`);
    if (report.errors.length > 20) console.log(`  ... and ${report.errors.length - 20} more`);
  }

  // Write progress
  fs.writeFileSync(
    path.join(__dirname, "..", "MIGRATION-PROGRESS.md"),
    `# Storage Migration Progress\n\n` +
      `- Date: ${new Date().toISOString()}\n` +
      `- Priority: ${priorityArg}\n` +
      `- Processed: ${report.processed}\n` +
      `- Uploaded: ${report.uploaded}\n` +
      `- Skipped: ${report.skipped}\n` +
      `- Errors: ${report.errors.length}\n` +
      `- Not Found: ${report.notFound.length}\n` +
      `- Total Size: ${Math.round(report.totalBytes / 1024 / 1024)}MB\n` +
      `- Duration: ${Math.round(elapsed)}s\n`
  );
}

main().catch(console.error);
