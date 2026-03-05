import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateSongLibraryCache } from "@/lib/song-library";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");

// Song fields stored as { title, composer } in music_plan_edits
const SONG_FIELDS = [
  "prelude", "gathering", "penitentialAct", "gloria",
  "gospelAcclamation", "offertory", "lordsPrayer",
  "fractionRite", "sending",
];

/**
 * POST /api/songs/[id]/replace
 * Replaces song [id] with { replacementId }.
 * Transfers resources, updates planner references, removes the old song.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { replacementId } = await request.json();
  if (!replacementId) {
    return NextResponse.json({ error: "replacementId required" }, { status: 400 });
  }
  if (replacementId === id) {
    return NextResponse.json({ error: "Cannot replace a song with itself" }, { status: 400 });
  }

  try {
    const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
    const library = JSON.parse(raw);

    const oldIdx = library.findIndex((s: { id: string }) => s.id === id);
    const newIdx = library.findIndex((s: { id: string }) => s.id === replacementId);

    if (oldIdx === -1 || newIdx === -1) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const oldSong = library[oldIdx];
    const newSong = library[newIdx];
    const supabase = createAdminClient();

    // 1. Transfer Supabase song_resources to replacement
    await supabase
      .from("song_resources")
      .update({ song_id: replacementId })
      .eq("song_id", id);

    // 2. Merge JSON resources (dedup by id)
    const existingIds = new Set(newSong.resources.map((r: { id: string }) => r.id));
    for (const r of oldSong.resources) {
      if (!existingIds.has(r.id)) {
        newSong.resources.push(r);
      }
    }

    // 3. Union occasions
    const occasionSet = new Set([...newSong.occasions, ...oldSong.occasions]);
    newSong.occasions = [...occasionSet];

    // 4. Sum usageCount
    newSong.usageCount += oldSong.usageCount;

    // 5. Update music_plan_edits — song fields
    let updatedOverrides = 0;
    const allFields = [...SONG_FIELDS, "communionSongs"];

    const { data: rows } = await supabase
      .from("music_plan_edits")
      .select("occasion_id, ensemble_id, field, value")
      .in("field", allFields);

    if (rows) {
      for (const row of rows) {
        const val = row.value;
        if (!val) continue;

        let changed = false;

        if (row.field === "communionSongs" && Array.isArray(val)) {
          for (const entry of val) {
            if (entry?.title === oldSong.title) {
              entry.title = newSong.title;
              entry.composer = newSong.composer || undefined;
              changed = true;
            }
          }
        } else if (val.title === oldSong.title) {
          val.title = newSong.title;
          val.composer = newSong.composer || undefined;
          changed = true;
        }

        if (changed) {
          await supabase.from("music_plan_edits").upsert(
            {
              occasion_id: row.occasion_id,
              ensemble_id: row.ensemble_id,
              field: row.field,
              value: val,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "occasion_id,ensemble_id,field" }
          );
          updatedOverrides++;
        }
      }
    }

    // 6. Record merge decision
    await supabase.from("song_merge_decisions").insert({
      song_id_a: replacementId,
      song_id_b: id,
      decision: "merged",
    });

    // 7. Remove old song from JSON
    library.splice(oldIdx, 1);
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");

    // 8. Invalidate cache
    invalidateSongLibraryCache();

    return NextResponse.json({ success: true, updatedOverrides });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
