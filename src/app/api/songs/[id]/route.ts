import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin";
}

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

    library.splice(idx, 1);
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
