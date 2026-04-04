export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import SetlistShell from "@/components/setlist/SetlistShell";

interface Props {
  params: Promise<{ massEventId: string }>;
}

export default async function SetlistPage({ params }: Props) {
  const { massEventId } = await params;
  const supabase = createAdminClient();

  // Get current user's parish_id for generation
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  let parishId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("parish_id")
      .eq("id", user.id)
      .single();
    parishId = profile?.parish_id || null;
  }

  // Fetch mass event
  const { data: mass } = await supabase
    .from("mass_events")
    .select("id, title, event_date, start_time_12h, ensemble, liturgical_name, occasion_id, season, choir_descriptor, celebrant")
    .eq("id", massEventId)
    .single();

  if (!mass) notFound();

  // Fetch existing setlist (if any)
  const { data: setlist } = await supabase
    .from("setlists")
    .select("*")
    .eq("mass_event_id", massEventId)
    .maybeSingle();

  // Fetch booking slots for personnel
  const { data: slots } = await supabase
    .from("booking_slots")
    .select(`
      *,
      profile:profiles (id, full_name, avatar_url),
      ministry_role:ministry_roles (id, name, sort_order)
    `)
    .eq("mass_event_id", massEventId);

  // Fetch choir signups for this mass
  const { data: choirSignups } = await supabase
    .from("choir_signups")
    .select(`
      *,
      profile:profiles (id, full_name, avatar_url, ensemble)
    `)
    .eq("mass_event_id", massEventId)
    .eq("status", "confirmed");

  // Fetch occasion JSON if available
  let occasion = null;
  if (mass.occasion_id) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/occasions/${mass.occasion_id}`,
        { cache: "no-store" }
      );
      if (res.ok) occasion = await res.json();
    } catch {
      // Occasion not found — that's fine, just no bootstrap
    }
  }

  // Fetch verse counts for songs in the setlist
  const verseCounts: Record<string, number> = {};
  if (setlist?.songs) {
    const songIds = (setlist.songs as { songs: { song_library_id?: string }[] }[])
      .flatMap((r) => r.songs)
      .map((s) => s.song_library_id)
      .filter(Boolean) as string[];
    if (songIds.length > 0) {
      const { data: songsWithVerses } = await supabase
        .from("songs")
        .select("id, verse_count")
        .in("id", songIds)
        .not("verse_count", "is", null);
      for (const s of songsWithVerses || []) {
        verseCounts[s.id] = s.verse_count;
      }
    }
  }

  return (
    <div className="min-h-screen">
      <SetlistShell
        mass={mass}
        existingSetlist={setlist}
        bookingSlots={slots || []}
        choirSignups={choirSignups || []}
        verseCounts={verseCounts}
        occasion={occasion}
        parishId={parishId}
      />
    </div>
  );
}
