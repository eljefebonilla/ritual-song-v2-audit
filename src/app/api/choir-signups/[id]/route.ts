import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT /api/choir-signups/[id] — Update own choir signup
 * (voice_part change, or cancel/re-confirm)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();

  // RLS ensures users can only update their own signups
  const { data, error } = await supabase
    .from("choir_signups")
    .update({
      voice_part: body.voice_part,
      status: body.status,
    })
    .eq("id", id)
    .select(`
      *,
      profile:profiles (id, full_name, avatar_url, ensemble)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/choir-signups/[id] — Remove own choir signup
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // RLS ensures users can only delete their own signups
  const { error } = await supabase
    .from("choir_signups")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
