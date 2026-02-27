import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT /api/mass-comments/[id] — Update a comment
 * Member: can update own comment body (RLS enforced)
 * Admin: can also toggle is_pinned
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const isAdmin = await verifyAdmin();

  const update: Record<string, unknown> = {};
  if (body.body !== undefined) update.body = body.body.trim();
  if (isAdmin && body.is_pinned !== undefined) update.is_pinned = body.is_pinned;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // RLS handles ownership check for non-admins
  const { data, error } = await supabase
    .from("mass_comments")
    .update(update)
    .eq("id", id)
    .select(`
      *,
      author:profiles (id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/mass-comments/[id] — Delete a comment
 * Member: can delete own (RLS enforced)
 * Admin: can delete any (RLS admin policy)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS handles ownership/admin check
  const { error } = await supabase
    .from("mass_comments")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
