import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");

async function checkAdmin(request: NextRequest): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;

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
 * POST /api/songs/duplicates/undo — Reverse a merge, delete, or dismiss action
 */
export async function POST(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { type, preMergePrimary, removedSongs, dismissedPairs } = body as {
    type: "merge" | "delete" | "dismiss";
    preMergePrimary?: Record<string, unknown>;
    removedSongs?: Record<string, unknown>[];
    dismissedPairs?: { songIdA: string; songIdB: string }[];
  };

  try {
    const supabase = createAdminClient();

    if (type === "merge") {
      if (!preMergePrimary || !removedSongs?.length) {
        return NextResponse.json({ error: "preMergePrimary and removedSongs required for merge undo" }, { status: 400 });
      }

      const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
      const library = JSON.parse(raw);

      // Replace current primary with pre-merge snapshot
      const primaryId = preMergePrimary.id as string;
      const primaryIdx = library.findIndex((s: { id: string }) => s.id === primaryId);
      if (primaryIdx !== -1) {
        library[primaryIdx] = preMergePrimary;
      }

      // Re-add removed songs
      for (const song of removedSongs) {
        library.push(song);
      }

      fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");

      // Revert song_resources: reassign back to secondary IDs
      for (const song of removedSongs) {
        const secondaryId = song.id as string;
        // Get resource IDs that belong to this secondary song
        const resourceIds = (song as { resources?: { id: string }[] }).resources?.map(r => r.id) || [];
        if (resourceIds.length > 0) {
          await supabase
            .from("song_resources")
            .update({ song_id: secondaryId })
            .eq("song_id", primaryId)
            .in("id", resourceIds);
        }
      }

      // Delete merge decision records
      for (const song of removedSongs) {
        const secondaryId = song.id as string;
        await supabase
          .from("song_merge_decisions")
          .delete()
          .eq("song_id_a", primaryId)
          .eq("song_id_b", secondaryId)
          .eq("decision", "merged");
      }

      return NextResponse.json({ success: true });
    }

    if (type === "delete") {
      if (!removedSongs?.length) {
        return NextResponse.json({ error: "removedSongs required for delete undo" }, { status: 400 });
      }

      const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
      const library = JSON.parse(raw);

      for (const song of removedSongs) {
        library.push(song);
      }

      fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");

      return NextResponse.json({ success: true });
    }

    if (type === "dismiss") {
      if (!dismissedPairs?.length) {
        return NextResponse.json({ error: "dismissedPairs required for dismiss undo" }, { status: 400 });
      }

      for (const pair of dismissedPairs) {
        await supabase
          .from("song_merge_decisions")
          .delete()
          .eq("song_id_a", pair.songIdA)
          .eq("song_id_b", pair.songIdB)
          .eq("decision", "dismissed");
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid undo type" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
