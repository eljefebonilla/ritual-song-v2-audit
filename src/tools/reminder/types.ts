/**
 * Staffing & Reminder System — Types
 * Ref: DESIGN-SPEC-v2.md 11.11
 */

export interface UnderstaffedMass {
  massEventId: string;
  eventDate: string;
  startTime12h: string | null;
  liturgicalName: string | null;
  ensemble: string | null;
  celebrant: string | null;
  daysUntil: number;
  missingRoles: MissingRole[];
  filledRoles: FilledRole[];
  totalExpected: number;
  totalFilled: number;
}

export interface MissingRole {
  roleId: string;
  roleName: string;
}

export interface FilledRole {
  roleId: string;
  roleName: string;
  profileId: string | null;
  personName: string | null;
  fullName: string | null;
  confirmation: string;
}

export interface ReminderCandidate {
  profileId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  smsConsent: boolean;
  massEventId: string;
  eventDate: string;
  startTime12h: string | null;
  liturgicalName: string | null;
  roleName: string;
  confirmation: string;
}

export interface ScanResult {
  understaffedMasses: UnderstaffedMass[];
  upcomingReminders: ReminderCandidate[];
  scannedAt: string;
}

export interface StaffingConfig {
  understaffedLookaheadDays: number; // default 14
  reminderDaysBefore: number[]; // default [7, 1]
  requiredRoles: string[]; // roles that trigger "understaffed" when missing
}

export const DEFAULT_STAFFING_CONFIG: StaffingConfig = {
  understaffedLookaheadDays: 14,
  reminderDaysBefore: [7, 1],
  requiredRoles: ["Director", "Cantor", "Piano"],
};
