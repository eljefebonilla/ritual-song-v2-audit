import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import fs from "fs";
import path from "path";
import type { LibrarySong } from "@/lib/types";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");
const MUSIC_DIR = path.join(process.cwd(), "..", "Song Folders", "Music");

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; resourceId: string }> }
) {
  const { id, resourceId } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // UUID format = Supabase resource
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId);

    if (isUuid) {
      const supabase = createAdminClient();

      // Look up the resource
      const { data: resource, error: fetchError } = await supabase
        .from("song_resources")
        .select("id, storage_path")
        .eq("id", resourceId)
        .eq("song_id", id)
        .single();

      if (fetchError || !resource) {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 });
      }

      // Delete from Storage if it has a storage_path
      if (resource.storage_path) {
        await supabase.storage.from("song-resources").remove([resource.storage_path]);
      }

      // Delete DB row
      const { error: deleteError } = await supabase
        .from("song_resources")
        .delete()
        .eq("id", resourceId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Legacy path: local resource (ID from song-library.json)
    const library: LibrarySong[] = JSON.parse(
      fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
    );
    const song = library.find((s) => s.id === id);
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const resourceIdx = song.resources.findIndex((r) => r.id === resourceId);
    if (resourceIdx === -1) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const resource = song.resources[resourceIdx];

    // Delete file from disk if it has a filePath
    if (resource.filePath) {
      const filePath = path.join(MUSIC_DIR, resource.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove resource from song
    song.resources.splice(resourceIdx, 1);

    // Write back
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
