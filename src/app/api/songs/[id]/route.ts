import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient, resolveSongUuid } from "@/lib/supabase/admin";
import { invalidateSongLibraryCache } from "@/lib/song-library";
import fs from "fs";
import path from "path";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");

// Map camelCase body fields to snake_case DB columns
const FIELD_MAP: Record<string, string> = {
  title: "title",
  composer: "composer",
  category: "category",
  recordedKey: "recorded_key",
  psalmNumber: "psalm_number",
  massSettingId: "mass_setting_id",
  functions: "functions",
  firstLine: "first_line",
  refrainFirstLine: "refrain_first_line",
  languages: "languages",
  topics: "topics",
  scriptureRefs: "scripture_refs",
  liturgicalUse: "liturgical_use",
  catalogs: "catalogs",
  credits: "credits",
  tuneMeter: "tune_meter",
  isHiddenGlobal: "is_hidden_global",
  occasions: "occasions",
};

/**
 * PUT /api/songs/[id] — Update ANY song field (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();

  try {
    const supabase = createAdminClient();

    // Build update object with snake_case keys
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      const dbKey = FIELD_MAP[key];
      if (dbKey) {
        updates[dbKey] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Update in Supabase (try by legacy_id first, fall back to UUID)
    const { data, error } = await supabase
      .from("songs")
      .update(updates)
      .eq("legacy_id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      // No legacy_id match — try by UUID only if id looks like one
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUuid) {
        return NextResponse.json({ error: `Song not found: ${id}` }, { status: 404 });
      }

      const { data: data2, error: error2 } = await supabase
        .from("songs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error2) {
        return NextResponse.json({ error: error2.message }, { status: 404 });
      }

      invalidateSongLibraryCache();
      return NextResponse.json(data2);
    }

    // Invalidate server-side song cache
    invalidateSongLibraryCache();

    // Log changes to change_log for audit trail
    try {
      for (const [key, value] of Object.entries(body)) {
        const dbKey = FIELD_MAP[key];
        if (dbKey) {
          await supabase.from("change_log").insert({
            entity_type: "song",
            entity_id: data.id,
            field_changed: dbKey,
            new_value: JSON.stringify(value),
            changed_by: "admin",
          });
        }
      }
    } catch {
      // Change log is best-effort, don't fail the request
    }

    // Also update JSON backup for basic fields
    try {
      const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
      const library = JSON.parse(raw);
      const idx = library.findIndex((s: { id: string }) => s.id === id);
      if (idx !== -1) {
        if (body.title !== undefined) library[idx].title = body.title;
        if (body.composer !== undefined) library[idx].composer = body.composer || undefined;
        if (body.category !== undefined) library[idx].category = body.category;
        if (body.recordedKey !== undefined) library[idx].recordedKey = body.recordedKey || undefined;
        fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");
      }
    } catch {
      // JSON backup write failed — that's OK
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/songs/[id] — Delete a song (admin only)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const supabase = createAdminClient();

    // Delete all FK-dependent rows before deleting the song
    const songUuid = await resolveSongUuid(supabase, id);
    if (songUuid) {
      await Promise.all([
        supabase.from("song_resources_v2").delete().eq("song_id", songUuid),
        supabase.from("song_rankings").delete().eq("song_id", songUuid),
        supabase.from("song_visibility").delete().eq("song_id", songUuid),
        supabase.from("song_recommendations").delete().eq("song_id", songUuid),
        supabase.from("sacramental_songs").delete().eq("song_id", songUuid),
        supabase.from("parish_favorites").delete().eq("song_id", songUuid),
        supabase.from("scripture_song_mappings").delete().eq("song_id", songUuid),
        supabase.from("enrichment_queue").delete().eq("song_id", songUuid),
        supabase.from("enrichment_log").delete().eq("song_id", songUuid),
        supabase.from("song_embeddings").delete().eq("song_id", songUuid),
        supabase.from("verse_embeddings").delete().eq("song_id", songUuid),
      ]);
    }

    // Delete from Supabase (try by legacy_id first, fall back to UUID)
    const { data, error } = await supabase
      .from("songs")
      .delete()
      .eq("legacy_id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUuid) {
        return NextResponse.json({ error: `Song not found: ${id}` }, { status: 404 });
      }

      const { error: error2 } = await supabase
        .from("songs")
        .delete()
        .eq("id", id);

      if (error2) {
        return NextResponse.json({ error: error2.message }, { status: 404 });
      }
    }

    // Invalidate server-side song cache
    invalidateSongLibraryCache();

    // Also remove from JSON backup
    try {
      const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
      const library = JSON.parse(raw);
      const idx = library.findIndex((s: { id: string }) => s.id === id);
      if (idx !== -1) {
        library.splice(idx, 1);
        fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");
      }
    } catch {
      // JSON backup write failed — that's OK
    }

    return NextResponse.json({ success: true, deletedSong: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
