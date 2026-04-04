import { createAdminClient } from "../supabase/admin";
import type { BrandConfig, CoverImageResult } from "./types";

/**
 * Resolve the cover image for a given occasion.
 * Checks parish_cover_art table first, then falls back to a gradient.
 */
export async function resolveCoverImage(
  parishId: string,
  occasionCode: string,
  cycle: string,
  brand: BrandConfig
): Promise<CoverImageResult> {
  const supabase = createAdminClient();

  // Try exact match (parish + occasion + cycle)
  const { data: exactMatch } = await supabase
    .from("parish_cover_art")
    .select("image_url, storage_path")
    .eq("parish_id", parishId)
    .eq("occasion_code", occasionCode)
    .eq("cycle", cycle)
    .maybeSingle();

  if (exactMatch?.image_url || exactMatch?.storage_path) {
    return {
      kind: "image",
      url: exactMatch.image_url ?? "",
      storagePath: exactMatch.storage_path ?? "",
    };
  }

  // Try "all" cycle fallback (occasion-specific but cycle-agnostic)
  const { data: allCycleMatch } = await supabase
    .from("parish_cover_art")
    .select("image_url, storage_path")
    .eq("parish_id", parishId)
    .eq("occasion_code", occasionCode)
    .eq("cycle", "all")
    .maybeSingle();

  if (allCycleMatch?.image_url || allCycleMatch?.storage_path) {
    return {
      kind: "image",
      url: allCycleMatch.image_url ?? "",
      storagePath: allCycleMatch.storage_path ?? "",
    };
  }

  // Fallback: gradient using brand colors
  return {
    kind: "gradient",
    colors: [brand.primaryColor, brand.accentColor],
  };
}

/**
 * Fetch cover image bytes from Supabase storage.
 * Returns null if the image cannot be fetched.
 */
export async function fetchCoverImageBytes(
  storagePath: string
): Promise<{ bytes: Uint8Array; format: "png" | "jpg" } | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from("song-resources")
    .download(storagePath);

  if (error || !data) return null;

  const bytes = new Uint8Array(await data.arrayBuffer());
  const format = storagePath.toLowerCase().endsWith(".png") ? "png" : "jpg";

  return { bytes, format };
}
