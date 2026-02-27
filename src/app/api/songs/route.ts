import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSongLibrary } from "@/lib/song-library";
import fs from "fs";
import path from "path";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");

/**
 * GET /api/songs — Search/list songs from the library
 * Query params:
 *   ?q=alleluia         — search by title/composer
 *   ?category=psalm     — filter by category
 *   ?limit=20           — max results (default 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase();
  const category = searchParams.get("category");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  let songs = getSongLibrary();

  if (category) {
    songs = songs.filter((s) => s.category === category);
  }

  if (q) {
    songs = songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.composer && s.composer.toLowerCase().includes(q))
    );
  }

  return NextResponse.json(songs.slice(0, limit).map((s) => ({
    id: s.id,
    title: s.title,
    composer: s.composer || null,
    category: s.category || null,
    usageCount: s.usageCount,
  })));
}

/**
 * POST /api/songs — Add a new song to the library (admin only)
 * Body: { title, composer?, category? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { title, composer, category } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Generate slug ID
  const slug = [title, composer]
    .filter(Boolean)
    .join("--")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  try {
    const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
    const library = JSON.parse(raw);

    // Check for duplicate
    if (library.some((s: { id: string }) => s.id === slug)) {
      return NextResponse.json({ error: "Song already exists" }, { status: 409 });
    }

    const newSong = {
      id: slug,
      title: title.trim(),
      composer: composer?.trim() || undefined,
      category: category || "song",
      resources: [],
      usageCount: 0,
      occasions: [],
    };

    library.push(newSong);
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");

    return NextResponse.json(newSong, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
