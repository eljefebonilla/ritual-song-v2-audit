import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSongLibrary } from "@/lib/song-library";
import { normalizeTitle } from "@/lib/occasion-helpers";
import fs from "fs";
import path from "path";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");

/**
 * GET /api/songs — Search/list songs from the library
 * Query params:
 *   ?q=alleluia         — search by title/composer
 *   ?category=psalm     — filter by category
 *   ?limit=20           — max results (default 50)
 *   ?source=supabase    — force Supabase read
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase();
  const category = searchParams.get("category");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const source = searchParams.get("source");

  // Try Supabase first
  if (source === "supabase") {
    const supabase = createAdminClient();
    let query = supabase.from("songs").select("id, legacy_id, title, composer, category, usage_count");

    if (category) query = query.eq("category", category);
    if (q) query = query.or(`title.ilike.%${q}%,composer.ilike.%${q}%`);
    query = query.limit(limit).order("title");

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map((s: Record<string, unknown>) => ({
      id: s.legacy_id,
      title: s.title,
      composer: s.composer || null,
      category: s.category || null,
      usageCount: s.usage_count,
    })));
  }

  // Fallback to JSON
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
  if (!(await verifyAdmin())) {
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

  // Check for duplicates unless force=true
  const force = new URL(request.url).searchParams.get("force") === "true";

  try {
    const supabase = createAdminClient();

    // Check for exact slug duplicate in Supabase
    const { data: existing } = await supabase
      .from("songs")
      .select("legacy_id")
      .eq("legacy_id", slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Song already exists" }, { status: 409 });
    }

    // Check for normalized title duplicates
    if (!force) {
      const normTitle = normalizeTitle(title.trim());
      const { data: allSongs } = await supabase
        .from("songs")
        .select("legacy_id, title, composer, usage_count")
        .ilike("title", `%${title.trim().substring(0, 10)}%`);

      const matches = (allSongs || []).filter(
        (s: Record<string, unknown>) => normalizeTitle(s.title as string) === normTitle
      );

      if (matches.length > 0) {
        return NextResponse.json({
          warning: "potential_duplicates",
          matches: matches.map((s: Record<string, unknown>) => ({
            id: s.legacy_id,
            title: s.title,
            composer: s.composer || null,
            resourceCount: 0,
            usageCount: s.usage_count,
          })),
        });
      }
    }

    // Insert into Supabase
    const { data: newSong, error } = await supabase
      .from("songs")
      .insert({
        legacy_id: slug,
        title: title.trim(),
        composer: composer?.trim() || null,
        category: category || "song",
        usage_count: 0,
        occasions: [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also add to JSON for backup
    try {
      const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
      const library = JSON.parse(raw);
      if (!library.some((s: { id: string }) => s.id === slug)) {
        library.push({
          id: slug,
          title: title.trim(),
          composer: composer?.trim() || undefined,
          category: category || "song",
          resources: [],
          usageCount: 0,
          occasions: [],
        });
        fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");
      }
    } catch {
      // JSON backup write failed (e.g., on Vercel) — that's OK
    }

    return NextResponse.json({
      id: newSong.legacy_id,
      title: newSong.title,
      composer: newSong.composer,
      category: newSong.category,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
