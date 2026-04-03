/**
 * Musician History & Invoice — Types
 * Ref: DESIGN-SPEC-v2.md 11.11
 */

export interface HistoryEntry {
  slotId: string;
  massEventId: string;
  eventDate: string;
  startTime12h: string | null;
  eventType: string;
  ensemble: string | null;
  celebrant: string | null;
  liturgicalName: string | null;
  season: string | null;
  roleName: string;
  roleId: string;
  roleLabelOverride: string | null;
  instrumentDetail: string | null;
  confirmation: string;
  isRecurring: boolean;
  slotNotes: string | null;
}

export interface HistoryQueryArgs {
  profileId: string;
  from?: string; // ISO date
  to?: string;
  ensemble?: string;
  eventType?: string;
  roleId?: string;
}

export interface InvoiceData {
  musicianName: string;
  musicianEmail: string | null;
  musicianPhone: string | null;
  periodFrom: string;
  periodTo: string;
  payRatePerMass: number;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  paymentNotes: string | null;
  generatedAt: string;
}

export interface InvoiceLineItem {
  date: string;
  time: string | null;
  description: string; // "Palm Sunday — Heritage — Piano"
  role: string;
  rate: number;
}

export interface GenerateInvoiceArgs {
  profileId: string;
  from: string;
  to: string;
  customRate?: number;
}
