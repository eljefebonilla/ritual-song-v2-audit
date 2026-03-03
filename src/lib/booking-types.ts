// ============================================================
// Booking Grid + Choir Sign-Up + Setlist Builder — Types
// ============================================================

// ===== CONFIRMATION STATUS =====

export type ConfirmationStatus =
  | 'unconfirmed'  // name only, no response
  | 'confirmed'    // explicitly confirmed
  | 'declined'     // declined / not available
  | 'pending'      // asked, awaiting response
  | 'expected'     // recurring assignment (staff=assumed, contractor=needs confirm)
  | 'auto';        // unattended sound/playback

export const CONFIRMATION_DISPLAY: Record<ConfirmationStatus, string> = {
  unconfirmed: '',
  confirmed: '\u2705',
  declined: 'X',
  pending: '\u25CE',
  expected: '\u25C9',
  auto: 'AUTO',
};

export type BookingStatus = 'confirmed' | 'pending' | 'needs_attention' | 'na';

export type ChoirDescriptor =
  | 'Volunteers' | 'SMPREP' | 'Volunteers + SMPREP' | 'Cancelled' | 'N/A';

// ===== BOOKING GRID =====

export interface BookingSlot {
  id: string;
  mass_event_id: string;
  ministry_role_id: string;
  profile_id: string | null;
  person_name: string | null;
  confirmation: ConfirmationStatus;
  is_recurring: boolean;
  slot_order: number;
  role_label_override: string | null;
  instrument_detail: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  profile?: { id: string; full_name: string; avatar_url: string | null };
  ministry_role?: { id: string; name: string; sort_order: number };
}

// One cell in the booking grid (one role column for one Mass)
export interface BookingCell {
  role_name: string;
  role_id: string;
  sort_order: number;
  slots: BookingSlot[];
}

// One row in the booking grid (one Mass)
export interface BookingRow {
  mass_event_id: string;
  celebration: string;       // occasion liturgical_name
  date: string;
  time_12h: string;
  ensemble: string | null;
  celebrant: string | null;
  booking_status: BookingStatus;
  choir_descriptor: ChoirDescriptor | null;
  choir_summary: ChoirSummary | null;
  occasion_id: string | null;
  cells: Record<string, BookingCell>;  // keyed by ministry_role.name
}

// ===== CHOIR SIGN-UP =====

export type VoicePart = 'Soprano' | 'Alto' | 'Tenor' | 'Bass';

export type MusicianRole = 'vocalist' | 'instrumentalist' | 'cantor' | 'both';

export interface ChoirSignup {
  id: string;
  mass_event_id: string;
  user_id: string;
  voice_part: VoicePart | null;
  musician_role: MusicianRole;
  instrument_detail: string | null;
  notes: string | null;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
  // Joined
  profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    ensemble: string | null;
  };
}

export interface ChoirSummary {
  total: number;
  soprano: number;
  alto: number;
  tenor: number;
  bass: number;
  instrumentalists: number;
  display: string;  // "Volunteers [3S, 2A, 1T, 1B]"
  roster: Record<VoicePart, ChoirSignup[]>;
  instrumentalistList: ChoirSignup[];
}

// ===== MASS COMMENTS =====

export interface MassComment {
  id: string;
  mass_event_id: string;
  author_id: string | null;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// ===== SETLIST =====

export interface SetlistSongEntry {
  title: string;
  composer?: string;
  hymnal_number?: string;     // "464", "BB #639"
  song_library_id?: string;   // FK to song-library.json for resource links
}

export interface SetlistSongRow {
  position: string;           // "gathering", "psalm", "communion_1", "custom_1"
  label: string;              // "Gathering", "Responsorial Psalm", "Distribution of Ashes"
  songs: SetlistSongEntry[];  // 0-3 songs per position
  assignment_text?: string;   // "V1 - Helena; V2 - David+Arielle; V3 - ALL"
  thematic_note?: string;     // "Gospel: Calling of disciples" (italic in PDF)
  display_value?: string;     // "chanted", "N/A", "spoken or chanted"
  is_conditional?: boolean;   // "if needed" flag
}

export interface SetlistPersonnel {
  person_name: string;
  profile_id?: string;
  role_label: string;         // freeform: "MD/A. Guitar", "Tenor/Piano/Playback/MD"
  side: 'left' | 'right';    // which column in the footer
}

export interface SetlistSafetySong {
  title: string;
  composer?: string;
  hymnal_number?: string;
}

export interface Setlist {
  id: string;
  mass_event_id: string;
  occasion_name: string | null;
  special_designation: string | null;
  occasion_id: string | null;
  songs: SetlistSongRow[];
  personnel: SetlistPersonnel[];
  choir_label: string | null;
  safety_song: SetlistSafetySong | null;
  last_edited_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

// ===== PDF GENERATION =====

export interface SetlistPDFData {
  occasion_name: string;
  date_display: string;         // "January 25, 2026"
  time_display: string;         // "9:30am"
  ensemble?: string;            // "Heritage", "Generations"
  special_designation?: string; // "Catholic Schools' Week"
  season: string;
  song_rows: SetlistSongRow[];
  personnel_left: SetlistPersonnel[];   // instrumentalists
  personnel_right: SetlistPersonnel[];  // cantor, choir, presider, etc.
  choir_label?: string;
  safety_song?: SetlistSafetySong;
}
