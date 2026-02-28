import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "@/lib/admin";

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("announcements")
    .select(`
      *,
      author:profiles!author_id (id, full_name, avatar_url),
      comments (
        id,
        body,
        created_at,
        author:profiles!author_id (id, full_name, avatar_url)
      )
    `)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sort comments by created_at ascending within each announcement
  const sorted = (data || []).map((a: Record<string, unknown>) => ({
    ...a,
    comments: Array.isArray(a.comments)
      ? (a.comments as Record<string, unknown>[]).sort(
          (x, y) =>
            new Date(x.created_at as string).getTime() -
            new Date(y.created_at as string).getTime()
        )
      : [],
  }));

  return NextResponse.json(sorted);
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { title, content, community, pinned } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      title,
      body: content,
      community: community || null,
      pinned: pinned || false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
