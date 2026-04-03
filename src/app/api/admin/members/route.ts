import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/members — Create a new member manually (admin-only)
 * Body: { full_name, email?, phone?, ensemble?, musician_role?, voice_part?, instrument? }
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { full_name, email, phone, ensemble, musician_role, voice_part, instrument } = body;

  if (!full_name?.trim()) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Create auth user if email provided (so they can log in later)
  let userId: string | null = null;
  if (email) {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (authError) {
      // If user already exists, that's fine: just look them up
      if (authError.message.includes("already been registered")) {
        const { data: existing } = await supabase.auth.admin.listUsers();
        const found = existing?.users?.find((u) => u.email === email);
        userId = found?.id || null;
      } else {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }
    } else {
      userId = authUser?.user?.id || null;
    }
  }

  // Create or update profile
  if (userId) {
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: full_name.trim(),
      email: email || null,
      phone: phone || null,
      ensemble: ensemble || null,
      musician_role: musician_role || "vocalist",
      voice_part: voice_part || null,
      instrument: instrument || null,
      role: "member",
      status: "active",
    }, { onConflict: "id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: userId });
  }

  // No email: create a profile with a generated UUID (non-login member)
  const { data: profile, error } = await supabase.from("profiles").insert({
    full_name: full_name.trim(),
    email: email || null,
    phone: phone || null,
    ensemble: ensemble || null,
    musician_role: musician_role || "vocalist",
    voice_part: voice_part || null,
    instrument: instrument || null,
    role: "member",
    status: "active",
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: profile.id });
}

/**
 * PUT /api/admin/members — Update a member's profile (admin-only)
 * Body: { id, ...fields to update }
 */
export async function PUT(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Whitelist allowed fields
  const allowed = ["full_name", "email", "phone", "ensemble", "musician_role", "voice_part", "instrument", "instrument_detail", "role", "status", "sms_consent", "pay_rate_per_mass", "seniority_tier", "available_for_subs"];
  const cleanUpdates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) cleanUpdates[key] = updates[key];
  }

  if (Object.keys(cleanUpdates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update(cleanUpdates).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id });
}
