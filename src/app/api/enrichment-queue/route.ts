import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/enrichment-queue?status=human_review&task_type=youtube_link&limit=50
 * Returns enrichment queue items with song details.
 */
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") || "human_review";
  const taskType = request.nextUrl.searchParams.get("task_type") || "youtube_link";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("enrichment_queue")
    .select("id, song_id, task_type, status, payload, created_at")
    .eq("status", status)
    .eq("task_type", taskType)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch song details for each item
  const songIds = [...new Set((data || []).map((d) => d.song_id))];
  const { data: songs } = await supabase
    .from("songs")
    .select("id, legacy_id, title, composer, category")
    .in("id", songIds);

  const songMap = new Map((songs || []).map((s) => [s.id, s]));

  const items = (data || []).map((item) => ({
    ...item,
    song: songMap.get(item.song_id) || null,
  }));

  return NextResponse.json({ items, total: items.length });
}

/**
 * POST /api/enrichment-queue
 * Approve or reject an enrichment queue item.
 * Body: { id: string, action: "approve" | "reject" }
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id, action } = await request.json();
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "id and action (approve|reject) required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch the queue item
  const { data: item, error: fetchErr } = await supabase
    .from("enrichment_queue")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (action === "approve") {
    // Write the YouTube URL to the song
    const url = item.payload?.url;
    if (url && item.task_type === "youtube_link") {
      const { error: updateErr } = await supabase
        .from("songs")
        .update({
          youtube_url: url,
          youtube_url_source: "ai_reviewed",
          youtube_url_verified_at: new Date().toISOString(),
        })
        .eq("id", item.song_id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    // Mark as processed
    await supabase
      .from("enrichment_queue")
      .update({ status: "approved", processed_at: new Date().toISOString() })
      .eq("id", id);
  } else {
    // Mark as rejected
    await supabase
      .from("enrichment_queue")
      .update({ status: "rejected", processed_at: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({ success: true });
}
