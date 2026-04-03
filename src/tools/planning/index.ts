/**
 * Planning Tool — MCP-style tool server for Plan a Mass
 * Ref: DESIGN-SPEC-v2.md 11.5, 16.3
 *
 * Registers tool handlers that the ConversationRuntime can invoke:
 * - planning.createEvent: Create calendar event + occasion from a planning session
 * - planning.assignSong: Assign a song to a liturgical position
 * - planning.saveNote: Save planning notes
 * - planning.inviteCollaborator: Add a collaborator to the planning session
 */

import type { ToolDefinition } from "@/runtime/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CreateEventArgs,
  AssignSongArgs,
  SaveNoteArgs,
  InviteCollaboratorArgs,
  MassSongSelections,
} from "./types";

export type {
  PlanningSession,
  MassSongSelections,
  MassPersonnel,
  MassType,
  SchoolLevel,
  PlanStatus,
} from "./types";

export function createPlanningTools(): ToolDefinition[] {
  return [
    {
      name: "planning.createEvent",
      description:
        "Create a calendar mass_event and optional occasion from a completed planning session. Populates date, time, celebrant, ensemble, and music assignments.",
      permissionLevel: "prompt",
      handler: async (args) => {
        const { sessionId } = args as unknown as CreateEventArgs;
        const supabase = createAdminClient();

        const { data: session } = await supabase
          .from("planning_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (!session) throw new Error("Planning session not found");

        // Map mass_type to event_type
        const eventTypeMap: Record<string, string> = {
          weekday: "mass",
          weekend: "mass",
          school: "school",
          sacramental: "sacrament",
          holy_day: "holy_day",
          special: "special",
        };

        // Create mass_event
        const { data: massEvent, error: eventError } = await supabase
          .from("mass_events")
          .insert({
            title: session.title || `${session.mass_type} Mass`,
            event_date: session.event_date,
            start_time: session.event_time,
            start_time_12h: session.event_time
              ? formatTime12h(session.event_time)
              : null,
            event_type: eventTypeMap[session.mass_type] || "mass",
            community: session.ensemble,
            celebrant: session.celebrant,
            has_music: session.has_music,
            occasion_id: session.occasion_id,
            liturgical_name: session.title,
          })
          .select()
          .single();

        if (eventError) throw new Error(`Failed to create event: ${eventError.message}`);

        // Link session to the new event
        await supabase
          .from("planning_sessions")
          .update({
            mass_event_id: massEvent.id,
            status: "confirmed",
          })
          .eq("id", sessionId);

        // Create booking slots from personnel
        const personnel = (session.personnel || {}) as Record<string, unknown>;
        const slotsToCreate: Record<string, unknown>[] = [];

        // Get ministry roles
        const { data: roles } = await supabase
          .from("ministry_roles")
          .select("id, name");

        const roleMap = new Map((roles || []).map((r) => [r.name, r.id]));

        if (personnel.director && roleMap.has("Director")) {
          slotsToCreate.push({
            mass_event_id: massEvent.id,
            ministry_role_id: roleMap.get("Director"),
            person_name: personnel.director,
            confirmation: "confirmed",
            slot_order: 0,
          });
        }
        if (personnel.cantor && roleMap.has("Cantor")) {
          slotsToCreate.push({
            mass_event_id: massEvent.id,
            ministry_role_id: roleMap.get("Cantor"),
            person_name: personnel.cantor,
            confirmation: "confirmed",
            slot_order: 0,
          });
        }
        if (personnel.pianist && roleMap.has("Piano")) {
          slotsToCreate.push({
            mass_event_id: massEvent.id,
            ministry_role_id: roleMap.get("Piano"),
            person_name: personnel.pianist,
            confirmation: "confirmed",
            slot_order: 0,
          });
        }

        if (slotsToCreate.length > 0) {
          await supabase.from("booking_slots").insert(slotsToCreate);
        }

        // Create setlist from song selections
        const selections = (session.selections || {}) as MassSongSelections;
        const songRows = Object.entries(selections).map(([position, songs]) => ({
          position,
          label: formatPositionLabel(position),
          songs: songs.map((s) => ({
            title: s.songTitle,
            composer: s.composer,
            hymnal_number: s.hymnalNumber,
            song_library_id: s.songLibraryId,
          })),
        }));

        if (songRows.length > 0) {
          await supabase.from("setlists").insert({
            mass_event_id: massEvent.id,
            occasion_name: session.title,
            occasion_id: session.occasion_id,
            songs: songRows,
            personnel: [],
            version: 1,
          });
        }

        return {
          massEventId: massEvent.id,
          status: "confirmed",
          message: "Event created and added to calendar",
        };
      },
    },
    {
      name: "planning.assignSong",
      description:
        "Assign a song to a liturgical position in the planning session. Auto-populates composer and hymnal number.",
      permissionLevel: "allow",
      handler: async (args) => {
        const { sessionId, position, songId, songTitle, composer, hymnalNumber } =
          args as unknown as AssignSongArgs;
        const supabase = createAdminClient();

        const { data: session } = await supabase
          .from("planning_sessions")
          .select("selections")
          .eq("id", sessionId)
          .single();

        if (!session) throw new Error("Session not found");

        const selections = (session.selections || {}) as MassSongSelections;
        const existing = selections[position] || [];

        // Toggle: remove if already assigned, add if new
        const idx = existing.findIndex((s) => s.songId === songId);
        if (idx >= 0) {
          existing.splice(idx, 1);
        } else {
          existing.push({ songId, songTitle, composer, hymnalNumber });
        }

        selections[position] = existing;

        await supabase
          .from("planning_sessions")
          .update({ selections })
          .eq("id", sessionId);

        return { position, songs: existing };
      },
    },
    {
      name: "planning.saveNote",
      description: "Save planning notes to the session.",
      permissionLevel: "allow",
      handler: async (args) => {
        const { sessionId, note } = args as unknown as SaveNoteArgs;
        const supabase = createAdminClient();

        await supabase
          .from("planning_sessions")
          .update({ planning_notes: note })
          .eq("id", sessionId);

        return { saved: true };
      },
    },
    {
      name: "planning.inviteCollaborator",
      description:
        "Invite a collaborator to the planning session by email or profile ID. Returns a share link.",
      permissionLevel: "prompt",
      handler: async (args) => {
        const { sessionId, email, profileId, role = "editor" } =
          args as unknown as InviteCollaboratorArgs;
        const supabase = createAdminClient();

        // Get the session for its share token
        const { data: session } = await supabase
          .from("planning_sessions")
          .select("share_token, collaborators")
          .eq("id", sessionId)
          .single();

        if (!session) throw new Error("Session not found");

        // Add to collaborators array if profileId provided
        if (profileId) {
          const collaborators = session.collaborators || [];
          if (!collaborators.includes(profileId)) {
            collaborators.push(profileId);
            await supabase
              .from("planning_sessions")
              .update({ collaborators })
              .eq("id", sessionId);
          }
        }

        // Create collaborator record
        await supabase.from("planning_collaborators").insert({
          session_id: sessionId,
          profile_id: profileId || null,
          invited_email: email || null,
          role,
        });

        const APP_URL =
          process.env.NEXT_PUBLIC_SITE_URL ||
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000");

        return {
          shareLink: `${APP_URL}/plan-a-mass/${session.share_token}`,
          shareToken: session.share_token,
        };
      },
    },
  ];
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

function formatPositionLabel(position: string): string {
  const labels: Record<string, string> = {
    gathering: "Gathering",
    psalm: "Responsorial Psalm",
    gospel_acclamation: "Gospel Acclamation",
    offertory: "Preparation of the Gifts",
    communion_1: "Communion",
    communion_2: "Communion 2",
    communion_3: "Communion 3",
    sending: "Sending Forth",
    prelude: "Prelude",
    meditation: "Meditation",
    choral_anthem: "Choral Anthem",
  };
  return labels[position] || position.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
