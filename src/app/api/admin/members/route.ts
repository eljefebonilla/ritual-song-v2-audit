import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PUT /api/admin/members — Update a member's role
 * Body: { id: string, role: "admin" | "member" }
 * Admin-only.
 */
export async function PUT(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { id, role } = body;

  if (!id || !role || !["admin", "member"].includes(role)) {
    return NextResponse.json(
      { error: "id and role (admin|member) are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id, role });
}
