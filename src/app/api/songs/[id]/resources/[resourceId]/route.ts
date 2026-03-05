import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSongById } from "@/lib/song-library";
import {
  buildLabelFromTags,
  buildStorageName,
  FILE_TYPE_TAG_IDS,
  MODIFIER_TAG_IDS,
  METADATA_TAG_IDS,
} from "@/lib/resource-tags";
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

      // Look up the resource (by UUID — globally unique)
      const { data: resource, error: fetchError } = await supabase
        .from("song_resources_v2")
        .select("id, storage_path")
        .eq("id", resourceId)
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
        .from("song_resources_v2")
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resourceId: string }> }
) {
  const { id, resourceId } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Only Supabase resources (UUID) can be edited
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId);
  if (!isUuid) {
    return NextResponse.json({ error: "Only Supabase resources can be edited" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { tags, visibility, label: requestLabel } = body;

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch existing resource (by UUID — globally unique)
    const { data: resource, error: fetchError } = await supabase
      .from("song_resources_v2")
      .select("*")
      .eq("id", resourceId)
      .single();

    if (fetchError || !resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Use provided label if non-empty, otherwise auto-generate from tags
    const newLabel = typeof requestLabel === "string" && requestLabel.trim()
      ? requestLabel.trim()
      : tags.length > 0 ? buildLabelFromTags(tags) : resource.label;
    const isHighlighted = tags.includes("AIM");

    // Prepare DB update
    const updateData: Record<string, unknown> = {
      tags,
      label: newLabel,
      is_highlighted: isHighlighted,
    };
    if (visibility === "all" || visibility === "admin") {
      updateData.visibility = visibility;
    }

    // If resource has a storage_path, compute new path and move the file
    if (resource.storage_path) {
      const song = getSongById(id);
      const typeTag = tags.find((t: string) => FILE_TYPE_TAG_IDS.includes(t));

      if (song && typeTag) {
        const oldPath: string = resource.storage_path;
        const ext = oldPath.includes(".")
          ? oldPath.slice(oldPath.lastIndexOf("."))
          : "";
        // Only include modifier tags (AIM, CLR) and custom tags in filename — exclude season/function
        const modifierTags = tags.filter((t: string) => MODIFIER_TAG_IDS.includes(t));
        const customTags = tags.filter(
          (t: string) => !FILE_TYPE_TAG_IDS.includes(t) && !MODIFIER_TAG_IDS.includes(t) && !METADATA_TAG_IDS.includes(t)
        );
        const allModifiers = [...modifierTags, ...customTags];

        // Storage paths include song_id prefix: "songId/filename"
        const dirPrefix = oldPath.includes("/")
          ? oldPath.slice(0, oldPath.lastIndexOf("/") + 1)
          : "";
        const newFilename = buildStorageName(
          song.title,
          song.composer,
          typeTag,
          allModifiers,
          ext
        );
        const newPath = dirPrefix + newFilename;

        if (newPath !== oldPath) {
          // Move file in storage
          const { error: moveError } = await supabase.storage
            .from("song-resources")
            .move(oldPath, newPath);

          if (moveError) {
            return NextResponse.json(
              { error: `Storage move failed: ${moveError.message}` },
              { status: 500 }
            );
          }

          // Update storage path and public URL
          updateData.storage_path = newPath;
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (supabaseUrl) {
            updateData.url = `${supabaseUrl}/storage/v1/object/public/song-resources/${newPath}`;
          }
        }
      }
    }

    // Update DB
    const { data: updated, error: updateError } = await supabase
      .from("song_resources_v2")
      .update(updateData)
      .eq("id", resourceId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      resource: {
        id: updated.id,
        type: updated.type,
        label: updated.label,
        url: updated.url,
        storagePath: updated.storage_path,
        source: updated.source,
        isHighlighted: updated.is_highlighted,
        tags: updated.tags || [],
        visibility: updated.visibility || "all",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
