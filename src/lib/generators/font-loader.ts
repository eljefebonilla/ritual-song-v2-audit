import { createAdminClient } from "../supabase/admin";
import type { FontAsset } from "./types";

/**
 * Font manifest: maps font family names to their storage paths.
 * Each parish can have its own fonts under fonts/{parish_id}/.
 * Falls back to web-safe fonts if no custom fonts are uploaded.
 */
const FONT_MANIFEST: Record<
  string,
  { path: string; weight: number; style: "normal" | "italic"; format: "truetype" | "opentype" }[]
> = {
  "Eidetic Neo": [
    { path: "eidetic-neo-regular.ttf", weight: 400, style: "normal", format: "truetype" },
    { path: "eidetic-neo-bold.ttf", weight: 700, style: "normal", format: "truetype" },
  ],
  "Minion Pro": [
    { path: "minion-pro-regular.otf", weight: 400, style: "normal", format: "opentype" },
    { path: "minion-pro-bold.otf", weight: 700, style: "normal", format: "opentype" },
    { path: "minion-pro-italic.otf", weight: 400, style: "italic", format: "opentype" },
  ],
};

/**
 * Load fonts for a parish as base64-encoded FontAssets.
 * Fetches from Supabase storage under fonts/{parishId}/.
 * Returns empty array if fonts aren't uploaded (Puppeteer will use system fonts).
 */
export async function loadParishFonts(
  parishId: string,
  headingFont: string,
  bodyFont: string
): Promise<FontAsset[]> {
  const families = new Set([headingFont, bodyFont]);
  const assets: FontAsset[] = [];
  const supabase = createAdminClient();

  for (const family of families) {
    const manifest = FONT_MANIFEST[family];
    if (!manifest) continue;

    for (const entry of manifest) {
      const storagePath = `fonts/${parishId}/${entry.path}`;

      try {
        const { data, error } = await supabase.storage
          .from("song-resources")
          .download(storagePath);

        if (error || !data) continue;

        const buffer = Buffer.from(await data.arrayBuffer());
        assets.push({
          family,
          weight: entry.weight,
          style: entry.style,
          base64: buffer.toString("base64"),
          format: entry.format,
        });
      } catch {
        // Font not uploaded for this parish, skip silently
      }
    }
  }

  return assets;
}
