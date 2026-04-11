import { createAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();

  // Check song_resources_v2 count
  const { count: totalResources } = await supabase.from("song_resources_v2").select("*", { count: "exact", head: true });
  console.log("Total song_resources_v2 rows:", totalResources);

  // Check how many songs have CONG resources
  const { data: congSongs } = await supabase.from("song_resources_v2").select("song_id").contains("tags", ["CONG"]);
  const uniqueCong = new Set(congSongs?.map(r => r.song_id));
  console.log("Songs with CONG resources:", uniqueCong.size);

  // Check total songs
  const { count: totalSongs } = await supabase.from("songs").select("*", { count: "exact", head: true });
  console.log("Total songs in catalog:", totalSongs);

  // Check the 4 missing songs from palm-sunday-c build
  const missing = ["Hosanna!", "The Lyric Psalter", "At The Cross (Love Ran Red)", "How Beautiful"];
  for (const title of missing) {
    const searchTerm = title.replace(/[()!]/g, "").trim();
    const { data: songs } = await supabase.from("songs").select("id, title, legacy_id").ilike("title", `%${searchTerm}%`).limit(5);
    if (songs && songs.length > 0) {
      for (const s of songs) {
        const { data: res } = await supabase.from("song_resources_v2").select("type, tags, storage_path, file_path").eq("song_id", s.id);
        console.log(`\n"${s.title}" (id: ${s.id}, legacy: ${s.legacy_id}):`);
        if (!res || res.length === 0) {
          console.log("  NO RESOURCES");
        } else {
          res.forEach(r => console.log(`  ${r.type} [${(r.tags || []).join(",")}] ${r.storage_path || r.file_path || "(no path)"}`));
        }
      }
    } else {
      console.log(`\n"${title}": NOT IN songs TABLE`);
    }
  }

  // Check parish_cover_art
  const { data: covers } = await supabase.from("parish_cover_art").select("*").eq("parish_id", "st-monica");
  console.log(`\nparish_cover_art for st-monica: ${covers?.length ?? 0} rows`);

  // Check if OCP local files exist
  const { readdirSync, existsSync } = await import("node:fs");
  const ocpPath = "/Users/jeffreybonilla/Desktop/OCP Fresh Resource Files";
  if (existsSync(ocpPath)) {
    const files = readdirSync(ocpPath);
    const gifs = files.filter(f => f.endsWith(".gif"));
    const txts = files.filter(f => f.endsWith(".txt"));
    const pdfs = files.filter(f => f.endsWith(".pdf"));
    console.log(`\nOCP Fresh Resource Files: ${gifs.length} GIF, ${txts.length} TXT, ${pdfs.length} PDF`);

    // Check if any of the missing songs have OCP files
    for (const title of missing) {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const matches = files.filter(f => f.toLowerCase().includes(slug.slice(0, 10)));
      if (matches.length > 0) {
        console.log(`  "${title}" -> ${matches.slice(0, 3).join(", ")}${matches.length > 3 ? ` (+${matches.length - 3} more)` : ""}`);
      }
    }
  }
}

main().catch(console.error);
