"use client";

import { useState, useCallback } from "react";
import MassPlanChatPanel from "./MassPlanChatPanel";
import type {
  MassType,
  SchoolLevel,
  MassSongSelections,
  MassPersonnel,
  CustomReading,
  PlanStatus,
} from "@/tools/planning/types";

// ─── Constants ──────────────────────────────────────────────────────────────

const MASS_TYPES: { value: MassType; label: string; description: string }[] = [
  { value: "weekend", label: "Weekend Mass", description: "Regular Sunday liturgy" },
  { value: "weekday", label: "Weekday Mass", description: "Daily Mass, often simpler" },
  { value: "school", label: "School Mass", description: "K-12 school liturgy" },
  { value: "sacramental", label: "Sacramental Mass", description: "Confirmation, First Communion, RCIA" },
  { value: "holy_day", label: "Holy Day", description: "Obligatory holy day" },
  { value: "special", label: "Special Liturgy", description: "Thanksgiving, bilingual, prayer service" },
];

const SCHOOL_LEVELS: { value: SchoolLevel; label: string }[] = [
  { value: "all", label: "All School" },
  { value: "upper", label: "Upper School (6-8)" },
  { value: "lower", label: "Lower School (TK-5)" },
  { value: "middle", label: "Middle School" },
];

const SONG_POSITIONS = [
  { key: "gathering", label: "Gathering" },
  { key: "psalm", label: "Responsorial Psalm" },
  { key: "gospel_acclamation", label: "Gospel Acclamation" },
  { key: "offertory", label: "Preparation of the Gifts" },
  { key: "communion_1", label: "Communion" },
  { key: "communion_2", label: "Communion 2" },
  { key: "sending", label: "Sending Forth" },
];

const WIZARD_STEPS = [
  "Mass Type",
  "Date & Logistics",
  "Music Config",
  "Readings",
  "Song Selection",
  "Personnel",
  "Notifications",
  "Review",
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface SongOption {
  id: string;
  title: string;
  composer: string | null;
  hymnal_number?: string;
}

interface MassPlanWizardShellProps {
  songs: SongOption[];
  sessionId?: string;
  initialData?: Partial<PlanFormData>;
  shareToken?: string | null;
  isDirector?: boolean;
}

interface PlanFormData {
  massType: MassType;
  schoolLevel: SchoolLevel | null;
  title: string;
  eventDate: string;
  eventTime: string;
  celebrant: string;
  isBishopCelebrating: boolean;
  hasMusic: boolean;
  ensemble: string;
  cantorRequested: boolean;
  pianoRequested: boolean;
  instrumentRequests: string[];
  usesDailyReadings: boolean;
  customReadings: CustomReading[];
  selections: MassSongSelections;
  personnel: MassPersonnel;
  planningNotes: string;
}

const DEFAULT_FORM: PlanFormData = {
  massType: "weekend",
  schoolLevel: null,
  title: "",
  eventDate: "",
  eventTime: "",
  celebrant: "",
  isBishopCelebrating: false,
  hasMusic: true,
  ensemble: "",
  cantorRequested: true,
  pianoRequested: true,
  instrumentRequests: [],
  usesDailyReadings: true,
  customReadings: [],
  selections: {},
  personnel: {},
  planningNotes: "",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function MassPlanWizardShell({
  songs,
  sessionId: initialSessionId,
  initialData,
  shareToken: initialShareToken,
  isDirector = true,
}: MassPlanWizardShellProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<PlanFormData>({ ...DEFAULT_FORM, ...initialData });
  const [saving, setSaving] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState(initialSessionId || null);
  const [shareToken, setShareToken] = useState(initialShareToken || null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const totalSteps = WIZARD_STEPS.length;

  const update = useCallback(<K extends keyof PlanFormData>(field: K, value: PlanFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Count completed sections
  const completedCount = [
    form.massType !== "weekend", // changed from default
    form.eventDate,
    form.hasMusic,
    true, // readings always has a valid state
    Object.keys(form.selections).length > 0,
    Object.keys(form.personnel).length > 0,
  ].filter(Boolean).length;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/plan-a-mass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: savedSessionId,
          mass_type: form.massType,
          school_level: form.schoolLevel,
          title: form.title || `${form.massType} Mass`,
          event_date: form.eventDate || null,
          event_time: form.eventTime || null,
          celebrant: form.celebrant || null,
          is_bishop_celebrating: form.isBishopCelebrating,
          has_music: form.hasMusic,
          ensemble: form.ensemble || null,
          cantor_requested: form.cantorRequested,
          piano_requested: form.pianoRequested,
          instrument_requests: form.instrumentRequests,
          uses_daily_readings: form.usesDailyReadings,
          custom_readings: form.customReadings,
          selections: form.selections,
          personnel: form.personnel,
          planning_notes: form.planningNotes || null,
          status: "in_progress" as PlanStatus,
        }),
      });
      const json = await res.json();
      if (json.session) {
        setSavedSessionId(json.session.id);
        setShareToken(json.session.share_token);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [savedSessionId, form]);

  const handleCreateOccasion = useCallback(async () => {
    if (!savedSessionId) {
      await handleSave();
    }
    setCreating(true);
    try {
      // Use the planning.createEvent tool via API
      const res = await fetch("/api/plan-a-mass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: savedSessionId,
          status: "confirmed",
        }),
      });
      if (res.ok) setCreated(true);
    } catch (err) {
      console.error("Create occasion failed:", err);
    } finally {
      setCreating(false);
    }
  }, [savedSessionId, handleSave]);

  const handleSelectSong = useCallback(
    (position: string, song: SongOption) => {
      setForm((prev) => {
        const selections = { ...prev.selections };
        const existing = selections[position] || [];
        const idx = existing.findIndex((s) => s.songId === song.id);
        if (idx >= 0) {
          selections[position] = existing.filter((_, i) => i !== idx);
        } else {
          selections[position] = [
            ...existing,
            {
              songId: song.id,
              songTitle: song.title,
              composer: song.composer || undefined,
              hymnalNumber: song.hymnal_number,
            },
          ];
        }
        return { ...prev, selections };
      });
    },
    []
  );

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-parish-gold/50 focus:border-parish-gold placeholder:text-stone-400";

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Ombre hero — green for planning (growth, preparation) */}
      <div
        className="px-6 pt-8 pb-6"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, color-mix(in srgb, #16a34a, transparent 88%), var(--color-background))",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
          Liturgy Planning
        </p>
        <h1 className="font-serif text-[1.75rem] font-light text-parish-charcoal mb-1">
          Plan a Mass
        </h1>
        <p className="text-sm text-muted">
          Build a complete liturgical plan with music, personnel, and calendar integration
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-xs text-muted">
            {completedCount} sections filled
          </span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-600 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step navigation pills */}
      <div className="px-6 py-3 flex gap-1 overflow-x-auto border-b border-border">
        {WIZARD_STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setCurrentStep(i)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              currentStep === i
                ? "bg-green-50 text-green-800 border border-green-200"
                : "text-muted hover:text-stone-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="px-6 py-6">
        {/* Step 0: Mass Type */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
                What are you planning?
              </h2>
              <p className="text-sm text-muted">
                Choose the type of liturgy. This determines available options in later steps.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MASS_TYPES.map((mt) => (
                <button
                  key={mt.value}
                  onClick={() => {
                    update("massType", mt.value);
                    if (mt.value !== "school") update("schoolLevel", null);
                  }}
                  className={`text-left p-4 rounded-lg border-2 transition-colors ${
                    form.massType === mt.value
                      ? "border-green-500 bg-green-50"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  <span className="block font-medium text-sm text-stone-900">{mt.label}</span>
                  <span className="block text-xs text-muted mt-0.5">{mt.description}</span>
                </button>
              ))}
            </div>
            {form.massType === "school" && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-2">
                  School Division
                </label>
                <div className="flex gap-2 flex-wrap">
                  {SCHOOL_LEVELS.map((sl) => (
                    <button
                      key={sl.value}
                      onClick={() => update("schoolLevel", sl.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        form.schoolLevel === sl.value
                          ? "border-green-500 bg-green-50 text-green-800"
                          : "border-stone-200 text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      {sl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Date & Logistics */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
                Date & Logistics
              </h2>
              <p className="text-sm text-muted">When and who?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="e.g. Palm Sunday, All School Mass"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Celebrant</label>
                <input
                  type="text"
                  value={form.celebrant}
                  onChange={(e) => update("celebrant", e.target.value)}
                  placeholder="Fr. Smith"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Date</label>
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => update("eventDate", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Time</label>
                <input
                  type="time"
                  value={form.eventTime}
                  onChange={(e) => update("eventTime", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Ensemble</label>
                <input
                  type="text"
                  value={form.ensemble}
                  onChange={(e) => update("ensemble", e.target.value)}
                  placeholder="Heritage, Generations, etc."
                  className={inputClass}
                />
              </div>
            </div>
            {(form.massType === "sacramental" || form.massType === "holy_day") && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isBishopCelebrating}
                  onChange={(e) => update("isBishopCelebrating", e.target.checked)}
                  className="rounded border-stone-300"
                />
                <span className="text-sm text-stone-700">Bishop is celebrating</span>
              </label>
            )}
          </div>
        )}

        {/* Step 2: Music Configuration */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
                Music Configuration
              </h2>
              <p className="text-sm text-muted">What musicians and instruments are needed?</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasMusic}
                onChange={(e) => update("hasMusic", e.target.checked)}
                className="rounded border-stone-300"
              />
              <span className="text-sm text-stone-700 font-medium">Music is requested for this Mass</span>
            </label>
            {form.hasMusic && (
              <div className="space-y-3 ml-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.cantorRequested}
                    onChange={(e) => update("cantorRequested", e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span className="text-sm text-stone-700">Cantor</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.pianoRequested}
                    onChange={(e) => update("pianoRequested", e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span className="text-sm text-stone-700">Piano</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Readings */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
                Readings
              </h2>
              <p className="text-sm text-muted">
                Are you using the readings of the day, or custom readings?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => update("usesDailyReadings", true)}
                className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${
                  form.usesDailyReadings
                    ? "border-green-500 bg-green-50 text-green-800"
                    : "border-stone-200 text-stone-600"
                }`}
              >
                Readings of the Day
              </button>
              <button
                onClick={() => update("usesDailyReadings", false)}
                className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${
                  !form.usesDailyReadings
                    ? "border-green-500 bg-green-50 text-green-800"
                    : "border-stone-200 text-stone-600"
                }`}
              >
                Custom Readings
              </button>
            </div>
            {!form.usesDailyReadings && (
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  Enter custom reading references. AI will generate a one-line synopsis (not verbatim scripture).
                </p>
                {["first_reading", "second_reading", "gospel"].map((pos) => {
                  const existing = form.customReadings.find((r) => r.position === pos);
                  return (
                    <div key={pos}>
                      <label className="block text-xs font-medium text-stone-600 mb-1 capitalize">
                        {pos.replace("_", " ")}
                      </label>
                      <input
                        type="text"
                        value={existing?.reference || ""}
                        onChange={(e) => {
                          const readings = [...form.customReadings.filter((r) => r.position !== pos)];
                          if (e.target.value) {
                            readings.push({ position: pos, reference: e.target.value });
                          }
                          update("customReadings", readings);
                        }}
                        placeholder="e.g. Isaiah 40:1-5"
                        className={inputClass}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Song Selection */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
                Song Selection
              </h2>
              <p className="text-sm text-muted">
                Choose songs for each liturgical position. Click to select/deselect.
              </p>
            </div>
            {SONG_POSITIONS.map(({ key, label }) => {
              const selected = form.selections[key] || [];
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-stone-800">{label}</h3>
                    {selected.length > 0 && (
                      <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        {selected.map((s) => s.songTitle).join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                    {songs.map((song) => {
                      const isSelected = selected.some((s) => s.songId === song.id);
                      return (
                        <button
                          key={song.id}
                          onClick={() => handleSelectSong(key, song)}
                          className={`text-left px-3 py-2 rounded-md text-xs transition-colors ${
                            isSelected
                              ? "bg-green-100 border border-green-300 text-green-900"
                              : "bg-stone-50 border border-stone-200 text-stone-700 hover:bg-stone-100"
                          }`}
                        >
                          <span className="font-medium">{song.title}</span>
                          {song.composer && (
                            <span className="text-muted ml-1">({song.composer})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Step 5: Personnel */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
                Personnel
              </h2>
              <p className="text-sm text-muted">Who is serving at this Mass?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Director</label>
                <input
                  type="text"
                  value={form.personnel.director || ""}
                  onChange={(e) => update("personnel", { ...form.personnel, director: e.target.value })}
                  placeholder="Music Director name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Cantor</label>
                <input
                  type="text"
                  value={form.personnel.cantor || ""}
                  onChange={(e) => update("personnel", { ...form.personnel, cantor: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Pianist</label>
                <input
                  type="text"
                  value={form.personnel.pianist || ""}
                  onChange={(e) => update("personnel", { ...form.personnel, pianist: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Sacristan</label>
                <input
                  type="text"
                  value={form.personnel.sacristan || ""}
                  onChange={(e) => update("personnel", { ...form.personnel, sacristan: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            {form.massType === "school" && (
              <div className="space-y-4 border-t border-stone-200 pt-4">
                <h3 className="text-sm font-medium text-stone-800">School Mass Personnel</h3>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Student Readers (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={(form.personnel.student_readers || []).join(", ")}
                    onChange={(e) =>
                      update("personnel", {
                        ...form.personnel,
                        student_readers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Maria, James, Sofia"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Gift Bearers (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={(form.personnel.gift_bearers || []).join(", ")}
                    onChange={(e) =>
                      update("personnel", {
                        ...form.personnel,
                        gift_bearers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Notifications */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
                Notifications & Sharing
              </h2>
              <p className="text-sm text-muted">
                Share this plan with collaborators. They can edit songs and personnel via the link.
              </p>
            </div>
            {shareToken && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs font-medium text-green-800 mb-1">Share Link</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white px-2 py-1 rounded border border-green-200 flex-1 truncate">
                    {typeof window !== "undefined" ? window.location.origin : ""}/plan-a-mass/{shareToken}
                  </code>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${window.location.origin}/plan-a-mass/${shareToken}`
                      )
                    }
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Planning Notes
              </label>
              <textarea
                value={form.planningNotes}
                onChange={(e) => update("planningNotes", e.target.value)}
                rows={4}
                placeholder="Notes for collaborators, special instructions..."
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Step 7: Review */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
                Review & Create
              </h2>
              <p className="text-sm text-muted">
                Review your plan, then create the occasion and populate the calendar.
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-stone-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Logistics</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Type</dt>
                    <dd className="text-stone-900 font-medium">
                      {MASS_TYPES.find((m) => m.value === form.massType)?.label}
                      {form.schoolLevel && ` (${SCHOOL_LEVELS.find((s) => s.value === form.schoolLevel)?.label})`}
                    </dd>
                  </div>
                  {form.eventDate && (
                    <div className="flex justify-between">
                      <dt className="text-stone-500">Date</dt>
                      <dd className="text-stone-900">{form.eventDate} {form.eventTime}</dd>
                    </div>
                  )}
                  {form.celebrant && (
                    <div className="flex justify-between">
                      <dt className="text-stone-500">Celebrant</dt>
                      <dd className="text-stone-900">{form.celebrant}</dd>
                    </div>
                  )}
                  {form.ensemble && (
                    <div className="flex justify-between">
                      <dt className="text-stone-500">Ensemble</dt>
                      <dd className="text-stone-900">{form.ensemble}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="bg-stone-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Music</h3>
                {Object.entries(form.selections).length > 0 ? (
                  <dl className="space-y-1 text-sm">
                    {Object.entries(form.selections).map(([pos, songs]) => (
                      <div key={pos} className="flex justify-between">
                        <dt className="text-stone-500 capitalize">{pos.replace(/_/g, " ")}</dt>
                        <dd className="text-stone-900 text-right max-w-[60%] truncate">
                          {songs.map((s) => s.songTitle).join(", ")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-stone-400">No songs selected yet</p>
                )}
              </div>

              <div className="bg-stone-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Personnel</h3>
                <dl className="space-y-1 text-sm">
                  {Object.entries(form.personnel)
                    .filter(([, v]) => v && (typeof v === "string" ? v : true))
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <dt className="text-stone-500 capitalize">{key.replace(/_/g, " ")}</dt>
                        <dd className="text-stone-900">
                          {Array.isArray(value) ? (value as string[]).join(", ") : String(value)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            </div>

            {created && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-medium">
                  Occasion created and added to calendar!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 flex items-center justify-between">
        <button
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 transition-colors disabled:opacity-30"
        >
          Back
        </button>
        {currentStep < totalSteps - 1 ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
              className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            {!created && (
              <button
                onClick={handleCreateOccasion}
                disabled={creating || !form.eventDate}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Occasion"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI Planning Chat */}
      <MassPlanChatPanel
        sessionId={savedSessionId}
        massType={form.massType}
        eventDate={form.eventDate}
      />
    </div>
  );
}
