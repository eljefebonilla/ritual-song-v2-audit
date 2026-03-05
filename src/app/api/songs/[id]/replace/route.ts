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
 *
 * Body: { replacementId, oldTitle, oldComposer }
 * oldTitle/oldComposer are used for planner JSONB matching (the old song
 * may already be gone from song-library.json).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { replacementId, oldTitle, oldComposer } = await request.json();
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

    // Replacement song must exist
    if (newIdx === -1) {
      return NextResponse.json({ error: "Replacement song not found" }, { status: 404 });
    }

    const oldSong = oldIdx !== -1 ? library[oldIdx] : null;
    const newSong = library[newIdx];

    // Use client-provided title for matching (old song may be gone from JSON)
    const matchTitle = oldSong?.title || oldTitle;
    if (!matchTitle) {
      return NextResponse.json({ error: "Could not determine old song title" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Transfer Supabase song_resources to replacement
    await supabase
      .from("song_resources")
      .update({ song_id: replacementId })
      .eq("song_id", id);

    // 2-4. Merge JSON data if old song exists in library
    if (oldSong) {
      const existingIds = new Set(newSong.resources.map((r: { id: string }) => r.id));
      for (const r of oldSong.resources) {
        if (!existingIds.has(r.id)) {
          newSong.resources.push(r);
        }
      }
      const occasionSet = new Set([...newSong.occasions, ...oldSong.occasions]);
      newSong.occasions = [...occasionSet];
      newSong.usageCount += oldSong.usageCount;
    }

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
            if (entry?.title === matchTitle) {
              entry.title = newSong.title;
              entry.composer = newSong.composer || undefined;
              changed = true;
            }
          }
        } else if (val.title === matchTitle) {
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

    // 7. Delete old song from Supabase
    await supabase.from("song_resources").delete().eq("song_id", id);
    await supabase.from("songs").delete().eq("legacy_id", id);
    // Also try by UUID in case legacy_id doesn't match
    await supabase.from("songs").delete().eq("id", id);

    // 8. Remove old song from JSON backup (best-effort)
    if (oldIdx !== -1) {
      try {
        library.splice(oldIdx, 1);
        fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");
      } catch {
        // JSON backup write failed — OK
      }
    }

    // 9. Invalidate cache
    invalidateSongLibraryCache();

    return NextResponse.json({ success: true, updatedOverrides });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
