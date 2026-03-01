import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import fs from "fs";
import path from "path";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");

/**
 * PUT /api/songs/[id] — Update a song (admin only)
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
    const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
    const library = JSON.parse(raw);
    const idx = library.findIndex((s: { id: string }) => s.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Update allowed fields
    if (body.title !== undefined) library[idx].title = body.title;
    if (body.composer !== undefined) library[idx].composer = body.composer || undefined;
    if (body.category !== undefined) library[idx].category = body.category;
    if (body.recordedKey !== undefined) library[idx].recordedKey = body.recordedKey || undefined;

    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");

    return NextResponse.json(library[idx]);
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
    const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
    const library = JSON.parse(raw);
    const idx = library.findIndex((s: { id: string }) => s.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const deletedSong = library.splice(idx, 1)[0];
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");

    return NextResponse.json({ success: true, deletedSong });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
