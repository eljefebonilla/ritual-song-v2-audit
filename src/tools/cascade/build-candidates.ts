/**
 * Build candidate list for a cascade sub-request.
 * Queries profiles by instrument/ensemble/seniority, filters by consent + availability.
 * Ref: DESIGN-SPEC-v2.md 15.2 — seniority tiers, sequential cascade
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { BuildCandidatesArgs, CascadeCandidate } from "./types";

export async function buildCandidateList(
  args: BuildCandidatesArgs
): Promise<CascadeCandidate[]> {
  const supabase = createAdminClient();

  // Get the role info for matching
  const { data: role } = await supabase
    .from("ministry_roles")
    .select("name")
    .eq("id", args.ministryRoleId)
    .single();

  // Build candidate query: same-capable musicians, consented, available for subs
  let query = supabase
    .from("profiles")
    .select("id, full_name, phone, sms_consent, instrument, voice_part, ensemble, seniority_tier")
    .eq("available_for_subs", true)
    .eq("sms_consent", true)
    .eq("status", "active")
    .not("phone", "is", null)
    .order("seniority_tier", { ascending: true })
    .order("full_name", { ascending: true });

  // Exclude the original musician
  if (args.originalMusicianId) {
    query = query.neq("id", args.originalMusicianId);
  }

  // Filter by instrument/voice for the role
  if (args.instrument) {
    query = query.eq("instrument", args.instrument);
  }
  if (args.ensemble) {
    query = query.eq("ensemble", args.ensemble);
  }

  const { data: profiles, error } = await query;
  if (error) throw new Error(`Failed to fetch candidates: ${error.message}`);
  if (!profiles || profiles.length === 0) return [];

  // Check availability: exclude anyone already booked for this mass
  const { data: bookedSlots } = await supabase
    .from("booking_slots")
    .select("profile_id")
    .eq("mass_event_id", args.massEventId)
    .not("profile_id", "is", null);

  const bookedIds = new Set((bookedSlots || []).map((s) => s.profile_id));

  // Filter out already-booked and build ordered candidate records
  const candidates: CascadeCandidate[] = [];
  let order = 1;

  for (const profile of profiles) {
    if (bookedIds.has(profile.id)) continue;

    candidates.push({
      id: "", // will be assigned by DB insert
      cascade_request_id: args.cascadeRequestId,
      profile_id: profile.id,
      seniority_tier: profile.seniority_tier ?? 3,
      contact_order: order++,
      status: "queued",
      contacted_at: null,
      responded_at: null,
      sms_sid: null,
      created_at: new Date().toISOString(),
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        phone: profile.phone,
        sms_consent: profile.sms_consent,
        instrument: profile.instrument,
        voice_part: profile.voice_part,
        ensemble: profile.ensemble,
      },
    });
  }

  // Insert all candidates into DB
  if (candidates.length > 0) {
    const rows = candidates.map((c) => ({
      cascade_request_id: c.cascade_request_id,
      profile_id: c.profile_id,
      seniority_tier: c.seniority_tier,
      contact_order: c.contact_order,
      status: "queued",
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("cascade_candidates")
      .insert(rows)
      .select("id, contact_order");

    if (insertError) throw new Error(`Failed to insert candidates: ${insertError.message}`);

    // Map DB-assigned IDs back
    if (inserted) {
      for (const row of inserted) {
        const match = candidates.find((c) => c.contact_order === row.contact_order);
        if (match) match.id = row.id;
      }
    }
  }

  return candidates;
}
