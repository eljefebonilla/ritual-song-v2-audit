import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { triggerGenerationIfReady } from "@/lib/generators/auto-trigger";

/**
 * PUT /api/setlists/[id] — Update a setlist (admin only)
 * Increments version on each save.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const body = await request.json();

  // Fetch current version for increment
  const { data: current, error: fetchError } = await supabase
    .from("setlists")
    .select("version")
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("setlists")
    .update({
      occasion_name: body.occasion_name,
      special_designation: body.special_designation,
      occasion_id: body.occasion_id,
      songs: body.songs,
      personnel: body.personnel,
      choir_label: body.choir_label,
      safety_song: body.safety_song,
      last_edited_by: user?.id || null,
      version: (current?.version || 0) + 1,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget: trigger auto-generation if setlist is complete
  triggerGenerationIfReady(data.id, data.songs).catch(() => {});

  return NextResponse.json(data);
}

/**
 * DELETE /api/setlists/[id] — Delete a setlist (admin only)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("setlists")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
