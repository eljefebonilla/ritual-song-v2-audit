import { createAdminClient } from "../supabase/admin";
import type { ReprintResult } from "./types";

/**
 * Resolve the best available reprint for a song in a worship aid.
 * Resolution order:
 *   1. CONG PDF (congregational PDF from song_resources_v2)
 *   2. CONG GIF (congregational GIF, lower quality raster)
 *   3. Lyrics text (LYR resource)
 *   4. Title-only (no printable resource found)
 *
 * For setlist/menus, use resolveSetlistReprint() which prefers
 * CC (Choral/Cantor) resources instead.
 */
export async function resolveWorshipAidReprint(
  songId: string
): Promise<ReprintResult> {
  const supabase = createAdminClient();

  // Fetch all resources for this song tagged CONG or LYR
  const { data: resources } = await supabase
    .from("song_resources_v2")
    .select("id, type, tags, storage_path, file_path, value")
    .eq("song_id", songId);

  if (!resources || resources.length === 0) {
    return { kind: "title_only" };
  }

  // 1. Look for CONG PDF
  const congPdf = resources.find(
    (r) =>
      Array.isArray(r.tags) &&
      r.tags.includes("CONG") &&
      r.type === "sheet_music" &&
      (r.storage_path?.endsWith(".pdf") || r.file_path?.endsWith(".pdf"))
  );

  if (congPdf) {
    const path = congPdf.storage_path || congPdf.file_path;
    return { kind: "pdf", storagePath: path! };
  }

  // 2. Look for CONG GIF
  const congGif = resources.find(
    (r) =>
      Array.isArray(r.tags) &&
      r.tags.includes("CONG") &&
      r.type === "sheet_music" &&
      (r.storage_path?.endsWith(".gif") || r.file_path?.endsWith(".gif"))
  );

  if (congGif) {
    const path = congGif.storage_path || congGif.file_path;
    return { kind: "gif", storagePath: path! };
  }

  // 2b. Look for CONG image (TIFF, PNG, JPG)
  const imageExts = [".tif", ".tiff", ".png", ".jpg", ".jpeg"];
  const congImage = resources.find(
    (r) =>
      Array.isArray(r.tags) &&
      r.tags.includes("CONG") &&
      r.type === "sheet_music" &&
      imageExts.some((ext) => r.storage_path?.endsWith(ext) || r.file_path?.endsWith(ext))
  );

  if (congImage) {
    const path = congImage.storage_path || congImage.file_path;
    return { kind: "image", storagePath: path! };
  }

  // 3. Look for lyrics
  const lyrics = resources.find(
    (r) =>
      r.type === "lyrics" ||
      (Array.isArray(r.tags) && r.tags.includes("LYR"))
  );

  if (lyrics?.value) {
    return { kind: "lyrics", text: lyrics.value };
  }

  // 4. Title-only fallback
  return { kind: "title_only" };
}

/**
 * Resolve reprint for setlist/menu (prefers Choral/Cantor resources).
 * Resolution order: CC PDF > CC GIF > CONG PDF > CONG GIF > title-only
 */
export async function resolveSetlistReprint(
  songId: string
): Promise<ReprintResult> {
  const supabase = createAdminClient();

  const { data: resources } = await supabase
    .from("song_resources_v2")
    .select("id, type, tags, storage_path, file_path")
    .eq("song_id", songId);

  if (!resources || resources.length === 0) {
    return { kind: "title_only" };
  }

  const tagPriority = ["CC", "CONG"];

  for (const tag of tagPriority) {
    // PDF first
    const pdf = resources.find(
      (r) =>
        Array.isArray(r.tags) &&
        r.tags.includes(tag) &&
        r.type === "sheet_music" &&
        (r.storage_path?.endsWith(".pdf") || r.file_path?.endsWith(".pdf"))
    );
    if (pdf) {
      const path = pdf.storage_path || pdf.file_path;
      return { kind: "pdf", storagePath: path! };
    }

    // GIF fallback
    const gif = resources.find(
      (r) =>
        Array.isArray(r.tags) &&
        r.tags.includes(tag) &&
        r.type === "sheet_music" &&
        (r.storage_path?.endsWith(".gif") || r.file_path?.endsWith(".gif"))
    );
    if (gif) {
      const path = gif.storage_path || gif.file_path;
      return { kind: "gif", storagePath: path! };
    }

    // Other image formats (TIFF, PNG, JPG)
    const imageExts = [".tif", ".tiff", ".png", ".jpg", ".jpeg"];
    const img = resources.find(
      (r) =>
        Array.isArray(r.tags) &&
        r.tags.includes(tag) &&
        r.type === "sheet_music" &&
        imageExts.some((ext) => r.storage_path?.endsWith(ext) || r.file_path?.endsWith(ext))
    );
    if (img) {
      const path = img.storage_path || img.file_path;
      return { kind: "image", storagePath: path! };
    }
  }

  return { kind: "title_only" };
}

/**
 * Fetch reprint PDF/image bytes from Supabase storage.
 * Retries once on transient failures. Returns null if both attempts fail.
 */
export async function fetchReprintBytes(
  storagePath: string,
  retries = 1
): Promise<Uint8Array | null> {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase.storage
      .from("song-resources")
      .download(storagePath);

    if (data) return new Uint8Array(await data.arrayBuffer());
    if (attempt < retries && error) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return null;
}
