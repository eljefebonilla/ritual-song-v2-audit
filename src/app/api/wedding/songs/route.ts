import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "@/lib/admin";

/**
 * PATCH /api/wedding/songs — Update a song (star, audio_url, youtube_url)
 * Director only.
 */
export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing song id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("sacramental_songs")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/wedding/songs — Add a new song to a step
 * Director only.
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { step_number, title, composer, category } = body;

  if (!step_number || !title) {
    return NextResponse.json(
      { error: "Missing step_number or title" },
      { status: 400 }
    );
  }

  // Get step label from step number
  const stepLabels: Record<number, string> = {
    1: "Preludes",
    2: "Processions",
    3: "Responsorial Psalm",
    4: "Gospel Acclamation",
    5: "Preparation of the Gifts",
    6: "Mass Setting",
    7: "Communion Song",
    8: "Meditation",
    9: "Flowers to Mary",
    10: "Recessional",
  };

  const { data, error } = await supabase
    .from("sacramental_songs")
    .insert({
      title,
      composer: composer || null,
      liturgy_type: "wedding",
      step_number,
      step_label: stepLabels[step_number] || `Step ${step_number}`,
      category: category || "Other",
      is_starred: false,
      sort_order: 999,
    })
    .select("id, title, composer, category, subcategory, instrumentation, is_starred, together_for_life_code, notes, song_id, step_number")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ song: data }, { status: 201 });
}

/**
 * DELETE /api/wedding/songs — Remove a song from the catalog
 * Director only.
 */
export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing song id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("sacramental_songs")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
