/**
 * Cascade Sub-Request System — Types
 * Ref: DESIGN-SPEC-v2.md 11.11, 15.2, 16.3
 */

export type CascadeStatus = "pending" | "active" | "filled" | "exhausted" | "cancelled";
export type CascadeUrgency = "normal" | "urgent";
export type CandidateStatus = "queued" | "contacted" | "accepted" | "declined" | "timeout" | "skipped";

export interface CascadeRequest {
  id: string;
  booking_slot_id: string;
  mass_event_id: string;
  initiated_by: string;
  original_musician_id: string | null;
  ministry_role_id: string | null;
  status: CascadeStatus;
  urgency: CascadeUrgency;
  timeout_minutes: number;
  message_template: string | null;
  created_at: string;
  updated_at: string;
  filled_at: string | null;
  filled_by: string | null;
}

export interface CascadeCandidate {
  id: string;
  cascade_request_id: string;
  profile_id: string;
  seniority_tier: number;
  contact_order: number;
  status: CandidateStatus;
  contacted_at: string | null;
  responded_at: string | null;
  sms_sid: string | null;
  created_at: string;
  // Joined fields
  profile?: {
    id: string;
    full_name: string;
    phone: string | null;
    sms_consent: boolean;
    instrument: string | null;
    voice_part: string | null;
    ensemble: string | null;
  };
}

export interface BuildCandidatesArgs {
  cascadeRequestId: string;
  massEventId: string;
  ministryRoleId: string;
  originalMusicianId?: string;
  instrument?: string;
  ensemble?: string;
}

export interface SendSmsArgs {
  cascadeRequestId: string;
  candidateId: string;
  massDate: string;
  massTime: string;
  roleName: string;
  celebration?: string;
}

export interface CheckResponseArgs {
  cascadeRequestId: string;
  candidateId: string;
}

export interface ExecuteCascadeArgs {
  cascadeRequestId: string;
}

export interface CascadeProgress {
  requestId: string;
  status: CascadeStatus;
  totalCandidates: number;
  contacted: number;
  currentCandidate: CascadeCandidate | null;
  accepted: CascadeCandidate | null;
  declined: CascadeCandidate[];
  timedOut: CascadeCandidate[];
  remaining: number;
}
