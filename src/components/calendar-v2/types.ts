// Shared types for Calendar V2 components

export interface USCCBDay {
  date: string;
  dayOfWeek: string;
  celebrationName: string;
  rank: string;
  colorPrimary: string;
  colorSecondary: string | null;
  colorAlternate: string | null;
  allColors: string[];
  citations: string;
  lectionaryNumber: number | null;
  psalterWeek: string | null;
  optionalMemorials: string[];
  isHolyday: boolean;
  isBVM: boolean;
  isUSA: boolean;
  isTransferred: boolean;
  ecclesiasticalProvince: string | null;
  specialReadingSets: string[];
  alternateReadings: string | null;
  notes: string[];
}

export interface MassEventV2 {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  startTime12h: string;
  endTime12h: string;
  title: string;
  ensemble: string | null;
  eventType: string;
  hasMusic: boolean;
  celebrant: string | null;
  location: string | null;
  notes: string | null;
}

export interface BookingPersonnel {
  massEventId: string;
  personName: string;
  roleName: string;
  confirmation: string;
}

export interface Holiday {
  date: string;
  name: string;
  type: "federal" | "state";
  state?: string;
}

export interface DayData {
  date: string;
  liturgical: USCCBDay | null;
  events: MassEventV2[];
  personnel: Map<string, BookingPersonnel[]>;
  holidays: Holiday[];
}
