import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/occasions/[id]/music-plan
 * Returns all music plan edits (overrides) for an occasion, grouped by community.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("music_plan_edits")
      .select("community_id, field, value")
      .eq("occasion_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by community_id → { [field]: value }
    const overrides: Record<string, Record<string, unknown>> = {};
    for (const row of data ?? []) {
      if (!overrides[row.community_id]) {
        overrides[row.community_id] = {};
      }
      overrides[row.community_id][row.field] = row.value;
    }

    return NextResponse.json(overrides);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/occasions/[id]/music-plan
 * Upserts a single music plan field override into Supabase.
 *
 * Body: {
 *   communityId: string;
 *   field: string;
 *   value: unknown;   // null = clear the field
 * }
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
  const { communityId, field, value } = body;

  if (!communityId || !field) {
    return NextResponse.json(
      { error: "communityId and field are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("music_plan_edits")
      .upsert(
        {
          occasion_id: id,
          community_id: communityId,
          field,
          value: value ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "occasion_id,community_id,field" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
