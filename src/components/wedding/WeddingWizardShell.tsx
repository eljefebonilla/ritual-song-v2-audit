"use client";

import { useState, useCallback } from "react";
import { WEDDING_STEPS, TFL_PSALM_CODES } from "@/lib/wedding-steps";
import type { WeddingStep } from "@/lib/wedding-steps";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SacramentalSong {
  id: string;
  title: string;
  composer: string | null;
  category: string;
  subcategory: string | null;
  instrumentation: string | null;
  is_starred: boolean;
  together_for_life_code: string | null;
  notes: string | null;
  song_id: string | null;
}

interface CantorProfile {
  id: string;
  display_name: string;
  is_bilingual: boolean;
  voice_type: string | null;
  bio: string | null;
  favorite_wedding_songs: string[];
  regular_masses: string[];
  audio_samples: { url: string; song_title: string }[];
}

interface WeddingSelections {
  [stepNumber: number]: {
    songId: string;
    songTitle: string;
    composer?: string;
    category?: string;
  }[];
}

interface WeddingDetails {
  coupleName1: string;
  coupleName2: string;
  contactEmail: string;
  contactPhone: string;
  eventDate: string;
  eventTime: string;
  rehearsalDate: string;
  rehearsalTime: string;
  celebrant: string;
  cantorId: string | null;
  notes: string;
}

interface WeddingWizardShellProps {
  songs: SacramentalSong[];
  cantors: CantorProfile[];
  eventId?: string;
  initialSelections?: WeddingSelections;
  initialDetails?: Partial<WeddingDetails>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WeddingWizardShell({
  songs,
  cantors,
  eventId,
  initialSelections,
  initialDetails,
}: WeddingWizardShellProps) {
  const [currentStep, setCurrentStep] = useState(0); // 0 = details, 1-10 = music steps, 11 = review
  const [selections, setSelections] = useState<WeddingSelections>(
    initialSelections || {}
  );
  const [details, setDetails] = useState<WeddingDetails>({
    coupleName1: "",
    coupleName2: "",
    contactEmail: "",
    contactPhone: "",
    eventDate: "",
    eventTime: "",
    rehearsalDate: "",
    rehearsalTime: "",
    celebrant: "",
    cantorId: null,
    notes: "",
    ...initialDetails,
  });

  const totalSteps = WEDDING_STEPS.length + 2; // details + 10 music steps + review

  const handleSelectSong = useCallback(
    (stepNumber: number, song: SacramentalSong) => {
      setSelections((prev) => {
        const step = WEDDING_STEPS.find((s) => s.number === stepNumber);
        const existing = prev[stepNumber] || [];

        if (step?.allowsMultiple) {
          // Toggle: add if not present, remove if present
          const idx = existing.findIndex((s) => s.songId === song.id);
          if (idx >= 0) {
            return {
              ...prev,
              [stepNumber]: existing.filter((_, i) => i !== idx),
            };
          }
          return {
            ...prev,
            [stepNumber]: [
              ...existing,
              {
                songId: song.id,
                songTitle: song.title,
                composer: song.composer || undefined,
                category: song.category,
              },
            ],
          };
        }

        // Single selection: replace
        return {
          ...prev,
          [stepNumber]: [
            {
              songId: song.id,
              songTitle: song.title,
              composer: song.composer || undefined,
              category: song.category,
            },
          ],
        };
      });
    },
    []
  );

  const songsForStep = useCallback(
    (stepNumber: number) =>
      songs.filter((s) => s.category !== "" || s.together_for_life_code !== null)
        .filter(() => true), // placeholder: filter by step_number when data is loaded
    [songs]
  );

  const isSelected = (stepNumber: number, songId: string) =>
    (selections[stepNumber] || []).some((s) => s.songId === songId);

  const completedSteps = Object.keys(selections).filter(
    (k) => (selections[Number(k)] || []).length > 0
  ).length;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Ombre hero — parish gold for wedding (celebratory) */}
      <div
        className="px-6 pt-8 pb-6"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, color-mix(in srgb, var(--color-parish-gold), transparent 85%), var(--color-background))",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
          Wedding Music
        </p>
        <h1 className="font-serif text-[1.75rem] font-light text-parish-charcoal mb-1">
          Planning Your Wedding Liturgy
        </h1>
        <p className="text-sm text-muted">
          A step-by-step guide to selecting music for your Catholic wedding ceremony
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-xs text-muted">
            {completedSteps} of {WEDDING_STEPS.length} selections made
          </span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-parish-gold rounded-full transition-all duration-300"
            style={{
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Step navigation pills */}
      <div className="px-6 py-3 flex gap-1 overflow-x-auto border-b border-border">
        <button
          onClick={() => setCurrentStep(0)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            currentStep === 0
              ? "bg-parish-gold/10 text-parish-charcoal border border-parish-gold/30"
              : "text-muted hover:text-stone-700"
          }`}
        >
          Details
        </button>
        {WEDDING_STEPS.map((step, i) => (
          <button
            key={step.number}
            onClick={() => setCurrentStep(i + 1)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              currentStep === i + 1
                ? "bg-parish-gold/10 text-parish-charcoal border border-parish-gold/30"
                : (selections[step.number] || []).length > 0
                  ? "text-green-700 bg-green-50"
                  : "text-muted hover:text-stone-700"
            }`}
          >
            {step.number}. {step.title}
          </button>
        ))}
        <button
          onClick={() => setCurrentStep(totalSteps - 1)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            currentStep === totalSteps - 1
              ? "bg-parish-gold/10 text-parish-charcoal border border-parish-gold/30"
              : "text-muted hover:text-stone-700"
          }`}
        >
          Review
        </button>
      </div>

      {/* Step content */}
      <div className="px-6 py-6">
        {currentStep === 0 && (
          <DetailsStep
            details={details}
            cantors={cantors}
            onChange={setDetails}
          />
        )}

        {currentStep >= 1 && currentStep <= WEDDING_STEPS.length && (
          <MusicStep
            step={WEDDING_STEPS[currentStep - 1]}
            songs={songsForStep(WEDDING_STEPS[currentStep - 1].number)}
            selections={selections[WEDDING_STEPS[currentStep - 1].number] || []}
            onSelect={(song) =>
              handleSelectSong(WEDDING_STEPS[currentStep - 1].number, song)
            }
            isSelected={(songId) =>
              isSelected(WEDDING_STEPS[currentStep - 1].number, songId)
            }
          />
        )}

        {currentStep === totalSteps - 1 && (
          <ReviewStep
            details={details}
            selections={selections}
            cantors={cantors}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="px-6 flex items-center justify-between">
        <button
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 transition-colors disabled:opacity-30"
        >
          Back
        </button>
        {currentStep < totalSteps - 1 ? (
          <button
            onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
            className="px-4 py-2 rounded-lg bg-parish-burgundy text-white font-medium text-sm hover:bg-parish-burgundy/90 transition-colors"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={() => {
              // TODO: Save to Supabase + generate PDF
              alert("Save and export coming soon");
            }}
            className="px-4 py-2 rounded-lg bg-parish-burgundy text-white font-medium text-sm hover:bg-parish-burgundy/90 transition-colors"
          >
            Save and Export PDF
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function DetailsStep({
  details,
  cantors,
  onChange,
}: {
  details: WeddingDetails;
  cantors: CantorProfile[];
  onChange: (d: WeddingDetails) => void;
}) {
  const update = (field: keyof WeddingDetails, value: string | null) =>
    onChange({ ...details, [field]: value });

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-parish-gold/50 focus:border-parish-gold placeholder:text-stone-400";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
          Wedding Details
        </h2>
        <p className="text-sm text-muted">
          Tell us about your ceremony so we can help plan the perfect music.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Partner 1
          </label>
          <input
            type="text"
            value={details.coupleName1}
            onChange={(e) => update("coupleName1", e.target.value)}
            placeholder="First and last name"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Partner 2
          </label>
          <input
            type="text"
            value={details.coupleName2}
            onChange={(e) => update("coupleName2", e.target.value)}
            placeholder="First and last name"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Contact Email
          </label>
          <input
            type="email"
            value={details.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            placeholder="email@example.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Contact Phone
          </label>
          <input
            type="tel"
            value={details.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
            placeholder="(310) 555-0100"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Wedding Date
          </label>
          <input
            type="date"
            value={details.eventDate}
            onChange={(e) => update("eventDate", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Ceremony Time
          </label>
          <input
            type="time"
            value={details.eventTime}
            onChange={(e) => update("eventTime", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Rehearsal Date
          </label>
          <input
            type="date"
            value={details.rehearsalDate}
            onChange={(e) => update("rehearsalDate", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Rehearsal Time
          </label>
          <input
            type="time"
            value={details.rehearsalTime}
            onChange={(e) => update("rehearsalTime", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">
          Celebrant (Priest or Deacon)
        </label>
        <input
          type="text"
          value={details.celebrant}
          onChange={(e) => update("celebrant", e.target.value)}
          placeholder="Fr. Name"
          className={inputClass}
        />
      </div>

      {/* Cantor selection */}
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-2">
          Choose Your Cantor
        </label>
        <p className="text-xs text-muted mb-3">
          Listen to audio samples to find the voice that resonates with you.
        </p>
        {cantors.length === 0 ? (
          <p className="text-sm text-stone-400 italic">
            No cantor profiles configured yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cantors.map((cantor) => (
              <button
                key={cantor.id}
                onClick={() =>
                  update(
                    "cantorId",
                    details.cantorId === cantor.id ? null : cantor.id
                  )
                }
                className={`text-left p-4 rounded-lg border transition-all ${
                  details.cantorId === cantor.id
                    ? "border-parish-gold bg-parish-gold/5 shadow-sm"
                    : "border-stone-200 bg-white hover:border-stone-300"
                }`}
              >
                <p className="font-medium text-sm text-stone-800">
                  {cantor.display_name}
                </p>
                {cantor.voice_type && (
                  <p className="text-xs text-muted mt-0.5">{cantor.voice_type}</p>
                )}
                {cantor.is_bilingual && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded">
                    Bilingual
                  </span>
                )}
                {cantor.bio && (
                  <p className="text-xs text-stone-500 mt-2 line-clamp-2">
                    {cantor.bio}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">
          Additional Notes
        </label>
        <textarea
          value={details.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Any special requests, cultural traditions, or notes for the music director..."
          rows={3}
          className={inputClass}
        />
      </div>
    </div>
  );
}

function MusicStep({
  step,
  songs,
  selections,
  onSelect,
  isSelected,
}: {
  step: WeddingStep;
  songs: SacramentalSong[];
  selections: { songId: string; songTitle: string }[];
  onSelect: (song: SacramentalSong) => void;
  isSelected: (songId: string) => boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered =
    activeCategory === "all"
      ? songs
      : songs.filter((s) => s.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Step header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-parish-gold/10 text-parish-gold text-xs font-bold">
            {step.number}
          </span>
          <h2 className="font-serif text-lg font-semibold text-parish-charcoal">
            {step.title}
          </h2>
          {step.isOptional && (
            <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
              Optional
            </span>
          )}
        </div>
        <p className="text-sm text-stone-600 ml-9">{step.subtitle}</p>
      </div>

      {/* Catechetical explanation */}
      <div className="ml-9 p-4 bg-stone-50 rounded-lg border-l-[3px] border-l-parish-gold">
        <p className="text-sm text-stone-600 leading-relaxed">
          {step.catechesis}
        </p>
      </div>

      {/* TFL codes (for psalm step) */}
      {step.tflCodes && (
        <div className="ml-9 space-y-2">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Together for Life Psalm Codes
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {step.tflCodes.map((code) => {
              const tfl = TFL_PSALM_CODES[code];
              if (!tfl) return null;
              return (
                <div
                  key={code}
                  className="p-3 bg-white rounded-lg border border-stone-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-parish-burgundy bg-parish-burgundy/10 px-1.5 py-0.5 rounded">
                      {tfl.code}
                    </span>
                    <span className="text-xs font-medium text-stone-700">
                      {tfl.psalm}
                    </span>
                  </div>
                  <p className="text-xs text-parish-burgundy font-medium mt-1 italic">
                    &ldquo;{tfl.refrain}&rdquo;
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category filter */}
      {step.categories.length > 1 && (
        <div className="ml-9 flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeCategory === "all"
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            All
          </button>
          {step.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeCategory === cat
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Song list */}
      <div className="ml-9 space-y-1.5">
        {filtered.length === 0 ? (
          <p className="text-sm text-stone-400 italic py-4">
            No songs loaded for this step yet. Songs will be imported from the Wedding Music Guide.
          </p>
        ) : (
          filtered.map((song) => (
            <button
              key={song.id}
              onClick={() => onSelect(song)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                isSelected(song.id)
                  ? "border-parish-gold bg-parish-gold/5 shadow-sm"
                  : "border-stone-100 bg-white hover:border-stone-200 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    {song.is_starred && (
                      <span className="text-parish-gold mr-1">&#9733;</span>
                    )}
                    {song.title}
                  </p>
                  {song.composer && (
                    <p className="text-xs text-stone-400 mt-0.5">
                      {song.composer}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {song.instrumentation && (
                    <span className="text-[10px] text-stone-400">
                      {song.instrumentation}
                    </span>
                  )}
                  {song.together_for_life_code && (
                    <span className="text-[10px] font-bold text-parish-burgundy bg-parish-burgundy/10 px-1.5 py-0.5 rounded">
                      {song.together_for_life_code}
                    </span>
                  )}
                  {isSelected(song.id) && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Current selection summary */}
      {selections.length > 0 && (
        <div className="ml-9 p-3 bg-green-50 rounded-lg">
          <p className="text-xs font-medium text-green-700">
            Selected: {selections.map((s) => s.songTitle).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewStep({
  details,
  selections,
  cantors,
}: {
  details: WeddingDetails;
  selections: WeddingSelections;
  cantors: CantorProfile[];
}) {
  const selectedCantor = cantors.find((c) => c.id === details.cantorId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
          Review Your Selections
        </h2>
        <p className="text-sm text-muted">
          Review everything before saving. You can go back to any step to make
          changes.
        </p>
      </div>

      {/* Details summary */}
      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">
          Wedding Details
        </h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-stone-400">Couple</span>
          <span className="text-stone-800">
            {details.coupleName1 && details.coupleName2
              ? `${details.coupleName1} & ${details.coupleName2}`
              : "Not entered"}
          </span>
          <span className="text-stone-400">Date</span>
          <span className="text-stone-800">
            {details.eventDate || "Not set"}
            {details.eventTime ? ` at ${details.eventTime}` : ""}
          </span>
          <span className="text-stone-400">Rehearsal</span>
          <span className="text-stone-800">
            {details.rehearsalDate || "Not set"}
            {details.rehearsalTime ? ` at ${details.rehearsalTime}` : ""}
          </span>
          <span className="text-stone-400">Celebrant</span>
          <span className="text-stone-800">
            {details.celebrant || "Not assigned"}
          </span>
          <span className="text-stone-400">Cantor</span>
          <span className="text-stone-800">
            {selectedCantor?.display_name || "Not selected"}
          </span>
        </div>
      </div>

      {/* Music selections */}
      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">
          Music Selections
        </h3>
        <div className="space-y-3">
          {WEDDING_STEPS.map((step) => {
            const picks = selections[step.number] || [];
            return (
              <div
                key={step.number}
                className="flex items-start gap-3 py-2 border-b border-stone-50 last:border-0"
              >
                <span className="text-xs font-bold text-parish-gold bg-parish-gold/10 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                  {step.number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-400">{step.title}</p>
                  {picks.length > 0 ? (
                    picks.map((p, i) => (
                      <p
                        key={i}
                        className="text-sm font-medium text-stone-800"
                      >
                        {p.songTitle}
                        {p.composer && (
                          <span className="text-xs text-stone-400 ml-1">
                            {p.composer}
                          </span>
                        )}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-stone-300 italic">
                      {step.isOptional ? "Skipped" : "Not selected"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
