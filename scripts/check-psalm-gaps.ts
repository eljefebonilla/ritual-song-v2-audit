/**
 * Check which psalm songs are missing resources in Supabase.
 * Usage: npx tsx scripts/check-psalm-gaps.ts
 */
import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // Get all psalm songs
  const { data: allPsalms } = await supabase
    .from("songs")
    .select("id, legacy_id, title, psalm_number, composer")
    .eq("category", "psalm")
    .order("psalm_number");

  if (!allPsalms) {
    console.error("No psalms found");
    return;
  }

  // Get all resources for psalm songs
  const psalmIds = allPsalms.map((p) => p.id);
  const { data: allRes } = await supabase
    .from("song_resources_v2")
    .select("song_id, type, label, file_path")
    .in("song_id", psalmIds);

  // Group resources by song_id
  const resByPsalm = new Map<string, typeof allRes>();
  for (const r of allRes || []) {
    const existing = resByPsalm.get(r.song_id) || [];
    existing.push(r);
    resByPsalm.set(r.song_id, existing);
  }

  const withRes: typeof allPsalms = [];
  const withoutRes: typeof allPsalms = [];

  for (const ps of allPsalms) {
    const resources = resByPsalm.get(ps.id) || [];
    if (resources.length > 0) {
      withRes.push(ps);
    } else {
      withoutRes.push(ps);
    }
  }

  console.log(`Total psalm songs: ${allPsalms.length}`);
  console.log(`WITH resources: ${withRes.length}`);
  console.log(`WITHOUT resources: ${withoutRes.length}\n`);

  console.log("=== Psalm Songs WITHOUT Resources ===");
  for (const s of withoutRes) {
    console.log(`  Ps ${s.psalm_number}: ${s.title} | ${s.composer}`);
  }

  // Count resources by label prefix
  const labelCounts = new Map<string, number>();
  for (const r of allRes || []) {
    const prefix = r.label.split(" - ")[0].split(" (")[0];
    labelCounts.set(prefix, (labelCounts.get(prefix) || 0) + 1);
  }
  console.log("\n=== Resource Labels ===");
  for (const [label, count] of [...labelCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label}: ${count}`);
  }
}

main();
