/**
 * GET /api/worship-aids/debug-reprint?title=Jesus,%20Living%20Bread
 * Debug endpoint: shows the reprint resolution chain for a song title.
 * Admin-only. DELETE THIS after debugging.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSongLibrary } from "@/lib/song-library";
import { resolveWorshipAidReprint } from "@/lib/generators/reprint-resolver";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const title = request.nextUrl.searchParams.get("title") || "Jesus, Living Bread";
  const supabase = createAdminClient();

  // Step 1: Find in local library
  const library = getSongLibrary();
  const norm = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const localMatch = library.find(
    (s) => s.title.toLowerCase().replace(/[^a-z0-9]/g, "") === norm
  );

  // Step 2: Look up UUID via legacy_id
  let supabaseUuid: string | null = null;
  let songsTableMatch = null;
  if (localMatch) {
    const { data } = await supabase
      .from("songs")
      .select("id, title, legacy_id")
      .eq("legacy_id", localMatch.id)
      .maybeSingle();
    songsTableMatch = data;
    supabaseUuid = data?.id ?? null;
  }

  // Step 3: Check song_resources_v2 directly
  let resources = null;
  if (supabaseUuid) {
    const { data } = await supabase
      .from("song_resources_v2")
      .select("id, type, tags, storage_path, file_path, url, source")
      .eq("song_id", supabaseUuid);
    resources = data;
  }

  // Step 4: Run the actual resolver
  let reprintResult = null;
  if (supabaseUuid) {
    reprintResult = await resolveWorshipAidReprint(supabaseUuid);
  }

  return NextResponse.json({
    searchTitle: title,
    normalizedTitle: norm,
    step1_localLibrary: localMatch
      ? { id: localMatch.id, title: localMatch.title, supabaseId: localMatch.supabaseId ?? null }
      : null,
    step2_songsTable: songsTableMatch,
    step3_supabaseUuid: supabaseUuid,
    step4_resources: resources,
    step5_resourceCount: resources?.length ?? 0,
    step6_reprintResult: reprintResult,
    step7_congTaggedResources: resources?.filter(
      (r: Record<string, unknown>) =>
        Array.isArray(r.tags) && (r.tags as string[]).includes("CONG")
    ) ?? [],
  });
}
