import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join("/Users/jeffreybonilla/Dropbox/RITUALSONG/ritualsong-app", ".env.local") });

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // Verify tags column
  const { data: test, error: te } = await s.from("song_resources_v2").select("id, tags, visibility").limit(1);
  console.log("v2 tags test:", te ? "ERROR: " + te.message : JSON.stringify(test?.[0]));

  // Get v1 resources
  const { data: v1 } = await s.from("song_resources").select("*");
  console.log("v1 resources to migrate:", v1?.length);

  for (const r of (v1 || [])) {
    const { data: song } = await s.from("songs").select("id").eq("legacy_id", r.song_id).single();
    if (song === null) {
      console.log("  SKIP (no song):", r.song_id);
      continue;
    }

    // Check if already in v2 by storage_path or url
    const { data: existing } = await s.from("song_resources_v2")
      .select("id")
      .eq("song_id", song.id)
      .eq("label", r.label)
      .maybeSingle();

    if (existing) {
      console.log("  SKIP (exists):", r.label);
      continue;
    }

    const { error } = await s.from("song_resources_v2").insert({
      song_id: song.id,
      type: r.type,
      label: r.label,
      url: r.url,
      storage_path: r.storage_path,
      source: r.source,
      is_highlighted: r.is_highlighted,
      tags: r.tags || [],
      visibility: r.visibility || "all",
    });
    console.log(error ? "  ERROR: " + error.message : "  Migrated: " + r.label);
  }
}

main().catch(console.error);
