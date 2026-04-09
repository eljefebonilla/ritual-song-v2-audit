import { NextRequest, NextResponse } from "next/server";
import { verifyAdminStrict } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeSharedViewConfig, listSharedViews } from "@/lib/shared-view";

export const dynamic = "force-dynamic";

/**
 * GET /api/shared-views
 * Admin-only list of all shared views.
 */
export async function GET() {
  if (!(await verifyAdminStrict())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const views = await listSharedViews();
    return NextResponse.json({ views });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/shared-views
 * Create a new shared view. Requires admin. Body: { name, config, expiresAt? }.
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdminStrict())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, config, expiresAt } = (body ?? {}) as {
    name?: string;
    config?: unknown;
    expiresAt?: string | null;
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 200) {
    return NextResponse.json({ error: "name too long" }, { status: 400 });
  }

  const cleanConfig = sanitizeSharedViewConfig(config);
  if (cleanConfig.types.length === 0) {
    return NextResponse.json({ error: "at least one view type required" }, { status: 400 });
  }

  const cleanExpiresAt =
    typeof expiresAt === "string" && expiresAt.length > 0 ? expiresAt : null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("shared_views")
      .insert({
        name: name.trim(),
        config: cleanConfig,
        expires_at: cleanExpiresAt,
        active: true,
      })
      .select("id, name, config, created_by, created_at, expires_at, active")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ view: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
