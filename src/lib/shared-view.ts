import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { YearCycleFilter, EnsembleId } from "@/lib/grid-types";
import type { LiturgicalSeason } from "@/lib/types";

export type SharedViewType = "planner" | "calendar" | "library";

export interface SharedViewConfig {
  types: SharedViewType[];
  yearCycle: YearCycleFilter;
  season: LiturgicalSeason | "all";
  ensembleId: EnsembleId;
  startOccasionId: string | null;
  endOccasionId: string | null;
  hiddenOccasionIds: string[];
  hidePastWeeks?: boolean;
  hideMassParts?: boolean;
  hideReadings?: boolean;
  hideSynopses?: boolean;
}

export interface SharedView {
  id: string;
  name: string;
  config: SharedViewConfig;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
  active: boolean;
}

type SharedViewRow = {
  id: string;
  name: string;
  config: unknown;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  active: boolean;
};

const TAB_ORDER: SharedViewType[] = ["planner", "calendar", "library"];
const ALLOWED_ENSEMBLES: EnsembleId[] = [
  "reflections",
  "foundations",
  "generations",
  "heritage",
  "elevations",
];

export const SHARED_VIEW_TYPE_LABELS: Record<SharedViewType, string> = {
  planner: "Multi-Week",
  calendar: "Calendar",
  library: "Song Library",
};

function sanitizeTypes(value: unknown): SharedViewType[] {
  if (!Array.isArray(value)) {
    return ["planner"];
  }
  const normalized = new Set<SharedViewType>();
  for (const type of value) {
    if (type === "planner" || type === "calendar" || type === "library") {
      normalized.add(type);
    }
  }
  const ordered = TAB_ORDER.filter((type) => normalized.has(type));
  return ordered.length > 0 ? ordered : ["planner"];
}

function sanitizeYearCycle(value: unknown): YearCycleFilter {
  return value === "A" || value === "B" || value === "C" || value === "all" ? value : "all";
}

const VALID_SEASONS = new Set<string>([
  "advent",
  "christmas",
  "lent",
  "holyweek",
  "easter",
  "ordinary",
  "solemnity",
  "feast",
  "all",
]);

function sanitizeSeason(value: unknown): LiturgicalSeason | "all" {
  if (typeof value === "string" && VALID_SEASONS.has(value)) {
    return value as LiturgicalSeason | "all";
  }
  return "all";
}

function sanitizeEnsemble(value: unknown): EnsembleId {
  if (typeof value === "string" && ALLOWED_ENSEMBLES.includes(value as EnsembleId)) {
    return value as EnsembleId;
  }
  return "reflections";
}

function sanitizeHiddenOccasionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") ids.push(entry);
  }
  return ids;
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

export function sanitizeSharedViewConfig(raw: unknown): SharedViewConfig {
  // Reject non-objects and arrays. Use a null-prototype object to prevent
  // prototype pollution from rogue __proto__ / constructor keys.
  const safeSource =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const obj = Object.assign(Object.create(null), safeSource) as Record<string, unknown>;
  return {
    types: sanitizeTypes(obj.types),
    yearCycle: sanitizeYearCycle(obj.yearCycle),
    season: sanitizeSeason(obj.season),
    ensembleId: sanitizeEnsemble(obj.ensembleId),
    startOccasionId: typeof obj.startOccasionId === "string" ? obj.startOccasionId : null,
    endOccasionId: typeof obj.endOccasionId === "string" ? obj.endOccasionId : null,
    hiddenOccasionIds: sanitizeHiddenOccasionIds(obj.hiddenOccasionIds),
    hidePastWeeks: sanitizeBoolean(obj.hidePastWeeks, false),
    hideMassParts: sanitizeBoolean(obj.hideMassParts, false),
    hideReadings: sanitizeBoolean(obj.hideReadings, false),
    hideSynopses: sanitizeBoolean(obj.hideSynopses, false),
  };
}

// Only fetch if token looks like a uuid (prevents wildcard / enumeration abuse)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getSharedView = cache(async (token: string): Promise<SharedView | null> => {
  if (!token || !UUID_RE.test(token)) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shared_views")
    .select("id, name, config, created_by, created_at, expires_at, active")
    .eq("id", token)
    .eq("active", true)
    .maybeSingle<SharedViewRow>();

  if (error) {
    console.error("Failed to load shared_view:", error.message);
    return null;
  }

  if (!data || !data.active) return null;

  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    config: sanitizeSharedViewConfig(data.config),
    createdBy: data.created_by,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
    active: data.active,
  };
});

export async function listSharedViews(): Promise<SharedView[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shared_views")
    .select("id, name, config, created_by, created_at, expires_at, active")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listSharedViews error:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    config: sanitizeSharedViewConfig(row.config),
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    active: row.active,
  }));
}
