import { NextRequest, NextResponse } from "next/server";
import { getSongLibrary } from "@/lib/song-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectDuplicateGroups, detectJunkEntries } from "@/lib/duplicate-detection";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");

/**
 * Verify admin via Supabase service role (works on Vercel unlike verifyAdmin).
 */
async function checkAdmin(request: NextRequest): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;

  // Check for Supabase auth token in cookie
  const supabase = createAdminClient();
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return profile?.role === "admin";
  }

  return false;
}

/**
 * GET /api/songs/duplicates — Returns duplicate groups and junk entries
 */
export async function GET() {
  try {
    const songs = getSongLibrary();
    const groups = detectDuplicateGroups(songs);
    const junk = detectJunkEntries(songs);

    const supabase = createAdminClient();
    const { data: decisions } = await supabase
      .from("song_merge_decisions")
      .select("song_id_a, song_id_b, decision");

    const dismissedPairs = new Set<string>();
    if (decisions) {
      for (const d of decisions) {
        if (d.decision === "dismissed") {
          dismissedPairs.add(`${d.song_id_a}::${d.song_id_b}`);
          dismissedPairs.add(`${d.song_id_b}::${d.song_id_a}`);
        }
      }
    }

    const filteredGroups = groups.filter((g) => {
      if (g.songs.length !== 2) return true;
      const key = `${g.songs[0].id}::${g.songs[1].id}`;
      return !dismissedPairs.has(key);
    });

    return NextResponse.json({
      groups: filteredGroups,
      junk,
      stats: {
        totalGroups: groups.length,
        filteredGroups: filteredGroups.length,
        dismissedCount: groups.length - filteredGroups.length,
        junkCount: junk.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/songs/duplicates — Merge two songs
 * Body: { primaryId, secondaryId }
 */
export async function POST(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { primaryId, secondaryId } = await request.json();
  if (!primaryId || !secondaryId) {
    return NextResponse.json({ error: "primaryId and secondaryId required" }, { status: 400 });
  }

  try {
    const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
    const library = JSON.parse(raw);

    const primaryIdx = library.findIndex((s: { id: string }) => s.id === primaryId);
    const secondaryIdx = library.findIndex((s: { id: string }) => s.id === secondaryId);

    if (primaryIdx === -1 || secondaryIdx === -1) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const primary = library[primaryIdx];
    const secondary = library[secondaryIdx];

    // Combine resources (dedup by id)
    const existingResourceIds = new Set(primary.resources.map((r: { id: string }) => r.id));
    for (const r of secondary.resources) {
      if (!existingResourceIds.has(r.id)) {
        primary.resources.push(r);
      }
    }

    // Combine occasions (dedup)
    const occasionSet = new Set([...primary.occasions, ...secondary.occasions]);
    primary.occasions = [...occasionSet];

    // Sum usageCount
    primary.usageCount += secondary.usageCount;

    // Update Supabase song_resources to point to primary
    const supabase = createAdminClient();
    await supabase
      .from("song_resources")
      .update({ song_id: primaryId })
      .eq("song_id", secondaryId);

    // Record the merge decision
    await supabase.from("song_merge_decisions").insert({
      song_id_a: primaryId,
      song_id_b: secondaryId,
      decision: "merged",
    });

    // Remove secondary from library
    library.splice(secondaryIdx, 1);
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");

    return NextResponse.json({
      merged: primary,
      removedId: secondaryId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/songs/duplicates — Dismiss a duplicate group
 * Body: { songIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { songIds } = await request.json();
  if (!songIds || songIds.length < 2) {
    return NextResponse.json({ error: "At least 2 songIds required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const inserts = [];
  for (let i = 0; i < songIds.length; i++) {
    for (let j = i + 1; j < songIds.length; j++) {
      inserts.push({
        song_id_a: songIds[i],
        song_id_b: songIds[j],
        decision: "dismissed",
      });
    }
  }

  const { error } = await supabase.from("song_merge_decisions").insert(inserts);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dismissed: songIds });
}
