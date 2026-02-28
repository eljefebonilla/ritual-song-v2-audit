import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { body: commentBody } = await request.json();

  if (!commentBody?.trim()) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("comments")
    .insert({
      announcement_id: id,
      body: commentBody.trim(),
    })
    .select(`
      *,
      author:profiles!author_id (id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
