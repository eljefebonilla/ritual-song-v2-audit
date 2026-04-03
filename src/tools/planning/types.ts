/**
 * Plan a Mass — Types
 * Ref: DESIGN-SPEC-v2.md 11.5
 */

export type MassType = "weekday" | "weekend" | "school" | "sacramental" | "holy_day" | "special";
export type SchoolLevel = "all" | "upper" | "lower" | "middle";
export type PlanStatus = "draft" | "in_progress" | "review" | "confirmed" | "completed";
export type CollaboratorRole = "viewer" | "editor" | "admin";

export interface PlanningSession {
  id: string;
  mass_type: MassType;
  school_level: SchoolLevel | null;
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  celebrant: string | null;
  is_bishop_celebrating: boolean;
  has_music: boolean;
  ensemble: string | null;
  cantor_requested: boolean;
  piano_requested: boolean;
  instrument_requests: string[];
  uses_daily_readings: boolean;
  custom_readings: CustomReading[];
  reading_synopses: Record<string, string>;
  selections: MassSongSelections;
  personnel: MassPersonnel;
  planning_notes: string | null;
  status: PlanStatus;
  share_token: string;
  collaborators: string[];
  mass_event_id: string | null;
  occasion_id: string | null;
  conversation_state: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomReading {
  position: string; // "first_reading", "second_reading", "gospel"
  reference: string; // "Isaiah 40:1-5"
  synopsis?: string; // AI-generated summary
}

export interface MassSongSelection {
  songId: string;
  songTitle: string;
  composer?: string;
  hymnalNumber?: string;
  songLibraryId?: string;
}

export interface MassSongSelections {
  [position: string]: MassSongSelection[];
}

export interface MassPersonnel {
  director?: string;
  cantor?: string;
  pianist?: string;
  instrumentalists?: { name: string; instrument: string; profileId?: string }[];
  choir_members?: string[];
  // School mass specific
  student_readers?: string[];
  gift_bearers?: string[];
  hospitality_ministers?: string[];
  ushers?: string[];
  eucharistic_ministers?: string[];
  sacristan?: string;
}

export interface CreateEventArgs {
  sessionId: string;
}

export interface AssignSongArgs {
  sessionId: string;
  position: string;
  songId: string;
  songTitle: string;
  composer?: string;
  hymnalNumber?: string;
}

export interface SaveNoteArgs {
  sessionId: string;
  note: string;
}

export interface InviteCollaboratorArgs {
  sessionId: string;
  email?: string;
  profileId?: string;
  role?: CollaboratorRole;
}
