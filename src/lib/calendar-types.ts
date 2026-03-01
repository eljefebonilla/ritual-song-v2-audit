// Types for the Ministry Director Calendar view

import type { LiturgicalSeason } from "./types";

export interface MinistryCalendar {
  title: string;
  yearCycle: string;
  startDate: string;
  endDate: string;
  weeks: CalendarWeek[];
}

export interface CalendarWeek {
  weekId: string;             // "advent-01" or "ordinary-04" — matches occasion IDs where possible
  liturgicalName: string;     // "FIRST SUNDAY OF ADVENT"
  theme: string;              // "Stay Awake, Be Ready"
  season: LiturgicalSeason;
  seasonEmoji: string;        // "🟣"
  sundayDate: string;         // "2025-11-30" ISO date of the Sunday
  events: CalendarEvent[];
}

export interface CalendarEvent {
  id?: string;                // Supabase mass_event UUID (absent in static JSON)
  date: string;               // "2025-11-29" ISO date
  dayOfWeek: string;          // "Saturday"
  startTime: string | null;   // "17:30" 24h format or null for all-day
  endTime: string | null;     // "18:30" or null
  startTime12h: string;       // "5:30p" original display format
  endTime12h: string;         // "6:30p"
  title: string;              // "Vigil Mass"
  community: string | null;   // "Reflections" | "Foundations" | etc.
  eventType: CalendarEventType;
  hasMusic: boolean;          // true if ♫ present
  isAutoMix: boolean;         // true if "Auto-Mix" in notes
  celebrant: string | null;   // "Fr. David" or null
  location: string | null;    // "Church" | "Outdoor Mass" | etc.
  notes: string | null;       // General notes
  sidebarNote: string | null; // ← sidebar annotation
  occasionId: string | null;  // Link to occasion JSON e.g. "advent-01-a"
  needsVolunteers: boolean;   // true if additional choir volunteers are needed
}

export type CalendarEventType =
  | "mass"
  | "rehearsal"
  | "special"
  | "school"
  | "sacrament"
  | "devotion"
  | "holiday"
  | "meeting"
  | "other";

export type CalendarView = "agenda" | "month";
