import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { LibrarySong, SongResource } from "@/lib/types";

const SONG_LIBRARY_PATH = path.join(
  process.cwd(),
  "src/data/song-library.json"
);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { type, label, url, source } = body;

    if (!type || !label) {
      return NextResponse.json(
        { error: "type and label are required" },
        { status: 400 }
      );
    }

    // Read current library
    const library: LibrarySong[] = JSON.parse(
      fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
    );

    // Find the song
    const song = library.find((s) => s.id === id);
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Determine source from URL or explicit source
    let resolvedSource = source || "manual";
    if (url && url.includes("youtube.com") || url && url.includes("youtu.be")) {
      resolvedSource = "youtube";
    }

    // Create new resource
    const resource: SongResource = {
      id: `${resolvedSource}-${slugify(label)}-${Date.now()}`,
      type,
      label,
      url: url || undefined,
      source: resolvedSource,
    };

    song.resources.push(resource);

    // Write back
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2));

    return NextResponse.json({ resource, song });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to add resource" },
      { status: 500 }
    );
  }
}
