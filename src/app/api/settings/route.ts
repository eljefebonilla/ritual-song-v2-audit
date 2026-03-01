import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/settings — Fetch all app settings
 * Returns a key-value map of app_settings rows.
 */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert array of {key, value} to a flat object
  const settings: Record<string, unknown> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json(settings);
}

/**
 * PUT /api/settings — Update one or more app settings (admin only)
 * Body: { "key1": value1, "key2": value2 }
 */
export async function PUT(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const body = await request.json();

  const entries = Object.entries(body);
  if (entries.length === 0) {
    return NextResponse.json({ error: "No settings provided" }, { status: 400 });
  }

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [key, value] of entries) {
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key, value: JSON.stringify(value), updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      errors.push(`${key}: ${error.message}`);
    } else {
      results[key] = value;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: errors.join("; "), updated: results },
      { status: 500 }
    );
  }

  return NextResponse.json(results);
}
