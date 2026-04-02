"use client";

import { useState, useCallback, useRef } from "react";
import { FUNERAL_STEPS, FUNERAL_PSALMS } from "@/lib/funeral-steps";
import type { FuneralStep } from "@/lib/funeral-steps";
import { useViewMode } from "@/hooks/useViewMode";

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
  step_number: number;
  audio_url?: string | null;
  youtube_url?: string | null;
  psalm_number?: number | null;
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

interface FuneralSelections {
  [stepNumber: number]: {
    songId: string;
    songTitle: string;
    composer?: string;
    category?: string;
  }[];
}

interface FuneralDetails {
  deceasedName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  eventDate: string;
  eventTime: string;
  celebrant: string;
  cantorId: string | null;
  serviceType: "full_mass" | "without_eucharist" | "vigil";
  notes: string;
}

interface FuneralWizardShellProps {
  songs: SacramentalSong[];
  cantors: CantorProfile[];
  eventId?: string;
  initialSelections?: FuneralSelections;
  initialDetails?: Partial<FuneralDetails>;
  isDirector?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FuneralWizardShell({
  songs: initialSongs,
  cantors,
  eventId,
  initialSelections,
  initialDetails,
  isDirector: isDirectorProp = false,
}: FuneralWizardShellProps) {
  const { effectiveIsAdmin } = useViewMode();
  const isDirector = isDirectorProp && effectiveIsAdmin;
  const [songs, setSongs] = useState<SacramentalSong[]>(initialSongs);
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<FuneralSelections>(
    initialSelections || {}
  );
  const [details, setDetails] = useState<FuneralDetails>({
    deceasedName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    eventDate: "",
    eventTime: "",
    celebrant: "",
    cantorId: null,
    serviceType: "full_mass",
    notes: "",
    ...initialDetails,
  });

  // Filter steps based on service type (without Eucharist omits steps 5-8)
  const activeSteps =
    details.serviceType === "without_eucharist"
      ? FUNERAL_STEPS.filter((s) => s.number < 5 || s.number > 8)
      : FUNERAL_STEPS;

  const totalSteps = activeSteps.length + 2; // details + steps + review

  const handleSelectSong = useCallback(
    (stepNumber: number, song: SacramentalSong) => {
      setSelections((prev) => {
        const step = FUNERAL_STEPS.find((s) => s.number === stepNumber);
        const existing = prev[stepNumber] || [];

        if (step?.allowsMultiple) {
          const idx = existing.findIndex((s) => s.songId === song.id);
          if (idx >= 0) {
            return {
              ...prev,
              [stepNumber]: existing.filter((_, i) => i !== idx),
            };
          }
          const max = step.selectCount || 99;
          if (existing.length >= max) return prev;
          return {
            ...prev,
            [stepNumber]: [
              ...existing,
              { songId: song.id, songTitle: song.title, composer: song.composer || undefined, category: song.category },
            ],
          };
        }

        if (existing.length === 1 && existing[0].songId === song.id) {
          return { ...prev, [stepNumber]: [] };
        }
        return {
          ...prev,
          [stepNumber]: [
            { songId: song.id, songTitle: song.title, composer: song.composer || undefined, category: song.category },
          ],
        };
      });
    },
    []
  );

  const [saving, setSaving] = useState(false);
  const [savedEventId, setSavedEventId] = useState(eventId || null);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const songsForStep = useCallback(
    (stepNumber: number) => songs.filter((s) => s.step_number === stepNumber),
    [songs]
  );

  const [exporting, setExporting] = useState(false);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: FuneralPDF } = await import("./pdf/FuneralPDF");
      const selectedCantor = cantors.find((c) => c.id === details.cantorId);
      const blob = await pdf(
        FuneralPDF({
          details,
          selections,
          cantorName: selectedCantor?.display_name,
        })
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${details.deceasedName || "Funeral"}-Music-Selections.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [details, selections, cantors]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/wedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: savedEventId,
          details: {
            ...details,
            coupleName1: details.contactName,
            coupleName2: "",
            contactEmail: details.contactEmail,
            contactPhone: details.contactPhone,
          },
          selections,
          eventType: "funeral",
        }),
      });
      const json = await res.json();
      if (json.event) {
        setSavedEventId(json.event.id);
        setShareToken(json.event.share_token);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [savedEventId, details, selections]);

  // Director actions
  const handleToggleStar = useCallback(async (songId: string) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;
    setSongs((prev) => prev.map((s) => s.id === songId ? { ...s, is_starred: !s.is_starred } : s));
    await fetch("/api/wedding/songs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: songId, is_starred: !song.is_starred }),
    });
  }, [songs]);

  const handleDeleteSong = useCallback(async (songId: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    await fetch("/api/wedding/songs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: songId }),
    });
  }, []);

  const handleAddSong = useCallback(async (stepNumber: number, title: string, composer: string, category: string) => {
    const res = await fetch("/api/wedding/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step_number: stepNumber, title, composer, category, liturgy_type: "funeral" }),
    });
    const { song } = await res.json();
    if (song) setSongs((prev) => [...prev, song]);
  }, []);

  const handleUpdateMedia = useCallback(async (songId: string, field: "audio_url" | "youtube_url", value: string) => {
    setSongs((prev) => prev.map((s) => s.id === songId ? { ...s, [field]: value } : s));
    await fetch("/api/wedding/songs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: songId, [field]: value }),
    });
  }, []);

  const isSelected = (stepNumber: number, songId: string) =>
    (selections[stepNumber] || []).some((s) => s.songId === songId);

  const completedSteps = Object.keys(selections).filter(
    (k) => (selections[Number(k)] || []).length > 0
  ).length;

  // Map currentStep index to actual step
  const getActiveStep = (idx: number) => activeSteps[idx - 1];

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Ombre hero — deep blue for funeral (solemn, comforting) */}
      <div
        className="px-6 pt-8 pb-6"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, color-mix(in srgb, #2C3E6B, transparent 85%), var(--color-background))",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
          Funeral Music
        </p>
        <h1 className="font-serif text-[1.75rem] font-light text-parish-charcoal mb-1">
          Planning the Funeral Liturgy
        </h1>
        <p className="text-sm text-muted">
          A gentle guide to selecting music that honors your loved one and offers comfort to all who gather
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-xs text-muted">
            {completedSteps} of {activeSteps.length} selections made
          </span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
              backgroundColor: "#2C3E6B",
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
              ? "bg-[#2C3E6B]/10 text-parish-charcoal border border-[#2C3E6B]/30"
              : "text-muted hover:text-stone-700"
          }`}
        >
          Details
        </button>
        {activeSteps.map((step, i) => (
          <button
            key={step.number}
            onClick={() => setCurrentStep(i + 1)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              currentStep === i + 1
                ? "bg-[#2C3E6B]/10 text-parish-charcoal border border-[#2C3E6B]/30"
                : (selections[step.number] || []).length > 0
                  ? "text-green-700 bg-green-50"
                  : "text-muted hover:text-stone-700"
            }`}
          >
            {step.title}
          </button>
        ))}
        <button
          onClick={() => setCurrentStep(totalSteps - 1)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            currentStep === totalSteps - 1
              ? "bg-[#2C3E6B]/10 text-parish-charcoal border border-[#2C3E6B]/30"
              : "text-muted hover:text-stone-700"
          }`}
        >
          Review
        </button>
      </div>

      {/* Step content */}
      <div className="px-6 py-6">
        {currentStep === 0 && (
          <FuneralDetailsStep
            details={details}
            cantors={cantors}
            onChange={setDetails}
          />
        )}

        {currentStep >= 1 && currentStep <= activeSteps.length && (() => {
          const step = getActiveStep(currentStep);
          if (!step) return null;
          return (
            <FuneralMusicStep
              key={`step-${step.number}`}
              step={step}
              songs={songsForStep(step.number)}
              selections={selections[step.number] || []}
              onSelect={(song) => handleSelectSong(step.number, song)}
              isSelected={(songId) => isSelected(step.number, songId)}
              isDirector={isDirector}
              onToggleStar={handleToggleStar}
              onDeleteSong={handleDeleteSong}
              onAddSong={handleAddSong}
              onUpdateMedia={handleUpdateMedia}
            />
          );
        })()}

        {currentStep === totalSteps - 1 && (
          <FuneralReviewStep
            details={details}
            selections={selections}
            activeSteps={activeSteps}
            cantors={cantors}
            shareToken={shareToken}
          />
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
          <button
            onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
            className="px-4 py-2 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-colors"
            style={{ backgroundColor: "#2C3E6B" }}
          >
            Continue
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              {exporting ? "Generating..." : "Export PDF"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#2C3E6B" }}
            >
              {saving ? "Saving..." : "Save Selections"}
            </button>
          </div>
        )}
      </div>

      {/* AI FAQ Chat */}
      <FuneralChatPanel />
    </div>
  );
}

// ─── Details Step ───────────────────────────────────────────────────────────

function FuneralDetailsStep({
  details,
  cantors,
  onChange,
}: {
  details: FuneralDetails;
  cantors: CantorProfile[];
  onChange: (d: FuneralDetails) => void;
}) {
  const update = (field: keyof FuneralDetails, value: string | null) =>
    onChange({ ...details, [field]: value } as FuneralDetails);

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/30 focus:border-[#2C3E6B] placeholder:text-stone-400";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">
          Service Details
        </h2>
        <p className="text-sm text-muted">
          We are here to help you through this process with care and sensitivity.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">
          Name of the Deceased
        </label>
        <input
          type="text"
          value={details.deceasedName}
          onChange={(e) => update("deceasedName", e.target.value)}
          placeholder="Full name"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-2">
          Type of Service
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { id: "full_mass", label: "Full Mass", desc: "Mass with Eucharist (all 10 steps)" },
            { id: "without_eucharist", label: "Without Eucharist", desc: "Steps 5-8 will be omitted" },
            { id: "vigil", label: "Vigil Service", desc: "Evening prayer service" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => update("serviceType", opt.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                details.serviceType === opt.id
                  ? "border-[#2C3E6B] bg-[#2C3E6B]/5 shadow-sm"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <p className="text-sm font-medium text-stone-800">{opt.label}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Family Contact Name</label>
          <input type="text" value={details.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Primary contact" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Contact Email</label>
          <input type="email" value={details.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} placeholder="email@example.com" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Contact Phone</label>
          <input type="tel" value={details.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} placeholder="(310) 555-0100" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Celebrant</label>
          <input type="text" value={details.celebrant} onChange={(e) => update("celebrant", e.target.value)} placeholder="Fr. Name" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Service Date</label>
          <input type="date" value={details.eventDate} onChange={(e) => update("eventDate", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Service Time</label>
          <input type="time" value={details.eventTime} onChange={(e) => update("eventTime", e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Cantor selection */}
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-2">Choose Your Cantor</label>
        {cantors.length === 0 ? (
          <p className="text-sm text-stone-400 italic">No cantor profiles configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cantors.map((cantor) => (
              <button
                key={cantor.id}
                onClick={() => update("cantorId", details.cantorId === cantor.id ? null : cantor.id)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  details.cantorId === cantor.id
                    ? "border-[#2C3E6B] bg-[#2C3E6B]/5 shadow-sm"
                    : "border-stone-200 bg-white hover:border-stone-300"
                }`}
              >
                <p className="font-medium text-sm text-stone-800">{cantor.display_name}</p>
                {cantor.voice_type && <p className="text-xs text-muted mt-0.5">{cantor.voice_type}</p>}
                {cantor.is_bilingual && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded">Bilingual</span>
                )}
                {cantor.audio_samples && cantor.audio_samples.length > 0 && (
                  <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                    {cantor.audio_samples.map((sample, i) => (
                      <AudioSample key={i} url={sample.url} title={sample.song_title} />
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Additional Notes</label>
        <textarea
          value={details.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Any special requests, cultural traditions, favorite songs of the deceased, or notes for the music director..."
          rows={3}
          className={inputClass}
        />
      </div>
    </div>
  );
}

// ─── Music Step ─────────────────────────────────────────────────────────────

function FuneralMusicStep({
  step,
  songs,
  selections,
  onSelect,
  isSelected,
  isDirector = false,
  onToggleStar,
  onDeleteSong,
  onAddSong,
  onUpdateMedia,
}: {
  step: FuneralStep;
  songs: SacramentalSong[];
  selections: { songId: string; songTitle: string }[];
  onSelect: (song: SacramentalSong) => void;
  isSelected: (songId: string) => boolean;
  isDirector?: boolean;
  onToggleStar?: (songId: string) => void;
  onDeleteSong?: (songId: string) => void;
  onAddSong?: (stepNumber: number, title: string, composer: string, category: string) => void;
  onUpdateMedia?: (songId: string, field: "audio_url" | "youtube_url", value: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newComposer, setNewComposer] = useState("");
  const [newCategory, setNewCategory] = useState(step.categories[0] || "");
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"audio_url" | "youtube_url">("youtube_url");

  const songCategories = [...new Set(songs.map((s) => s.category))];

  const filtered = activeCategory === "all" ? songs : songs.filter((s) => s.category === activeCategory);

  // Group psalm songs by psalm number for step 3
  const isPsalmStep = step.number === 3;

  return (
    <div className="space-y-4">
      {/* Step header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#2C3E6B]/10 text-[#2C3E6B] text-xs font-bold">
            {step.number}
          </span>
          <h2 className="font-serif text-lg font-semibold text-parish-charcoal">{step.title}</h2>
          {step.isOptional && (
            <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">Optional</span>
          )}
        </div>
        <p className="text-sm text-stone-600 ml-9">{step.subtitle}</p>
        {step.selectCount && (
          <p className="text-xs text-[#2C3E6B] ml-9 mt-1 font-medium">
            Please select up to {step.selectCount} songs
          </p>
        )}
      </div>

      {/* Pastoral explanation */}
      <div className="ml-9 p-4 bg-stone-50 rounded-lg border-l-[3px] border-l-[#2C3E6B]">
        <p className="text-sm text-stone-600 leading-relaxed">{step.catechesis}</p>
      </div>

      {/* Psalm refrains (for psalm step) */}
      {isPsalmStep && (
        <div className="ml-9 space-y-2">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Available Psalms
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FUNERAL_PSALMS.map((p) => (
              <div key={p.psalmNumber} className="p-3 bg-white rounded-lg border border-stone-200">
                <span className="text-xs font-bold text-[#2C3E6B]">{p.psalm}</span>
                <p className="text-xs text-[#2C3E6B]/80 font-medium mt-1 italic">
                  &ldquo;{p.refrain}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      {songCategories.length > 1 && (
        <div className="ml-9 flex gap-1 flex-wrap">
          <button onClick={() => setActiveCategory("all")} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${activeCategory === "all" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>All</button>
          {songCategories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${activeCategory === cat ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>{cat}</button>
          ))}
        </div>
      )}

      {/* Song list */}
      <div className="ml-9 space-y-1.5">
        {filtered.length === 0 ? (
          <p className="text-sm text-stone-400 italic py-4">No songs for this category yet.</p>
        ) : (
          filtered.map((song) => (
            <div
              key={song.id}
              className={`rounded-lg border transition-all ${isSelected(song.id) ? "border-[#2C3E6B] bg-[#2C3E6B]/5 shadow-sm" : "border-stone-100 bg-white hover:border-stone-200"}`}
            >
              <button onClick={() => onSelect(song)} className="w-full text-left px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800">
                      {song.is_starred && <span className="text-[#2C3E6B] mr-1">&#9733;</span>}
                      {song.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {song.composer && <span className="text-xs text-stone-400">{song.composer}</span>}
                    </div>
                    {song.notes && <p className="text-[10px] text-stone-400 mt-0.5 italic">{song.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {isSelected(song.id) && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>

              {/* Audio/YouTube preview */}
              {(song.audio_url || song.youtube_url) && (
                <div className="px-4 pb-2" onClick={(e) => e.stopPropagation()}>
                  {song.audio_url && <AudioSample url={song.audio_url} title="Listen" />}
                  {song.youtube_url && <YouTubePreview url={song.youtube_url} />}
                </div>
              )}

              {/* Director controls */}
              {isDirector && (
                <div className="px-4 pb-2 flex items-center gap-2 border-t border-stone-50 pt-1.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onToggleStar?.(song.id)} className="text-[10px] text-stone-400 hover:text-[#2C3E6B] transition-colors">
                    {song.is_starred ? "\u2605 Unstar" : "\u2606 Star"}
                  </button>
                  <span className="text-stone-200">|</span>
                  <button
                    onClick={() => { setEditingMediaId(editingMediaId === song.id ? null : song.id); setMediaUrl(song.audio_url || song.youtube_url || ""); setMediaType(song.audio_url ? "audio_url" : "youtube_url"); }}
                    className="text-[10px] text-stone-400 hover:text-blue-600 transition-colors"
                  >
                    {song.audio_url || song.youtube_url ? "Edit Link" : "+ Audio/YouTube"}
                  </button>
                  <span className="text-stone-200">|</span>
                  <button onClick={() => { if (confirm(`Remove "${song.title}"?`)) onDeleteSong?.(song.id); }} className="text-[10px] text-stone-400 hover:text-red-600 transition-colors">Remove</button>
                </div>
              )}

              {isDirector && editingMediaId === song.id && (
                <div className="px-4 pb-3 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button onClick={() => setMediaType("audio_url")} className={`px-2 py-0.5 text-[10px] rounded ${mediaType === "audio_url" ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-500"}`}>Audio URL</button>
                    <button onClick={() => setMediaType("youtube_url")} className={`px-2 py-0.5 text-[10px] rounded ${mediaType === "youtube_url" ? "bg-red-600 text-white" : "bg-stone-100 text-stone-500"}`}>YouTube</button>
                  </div>
                  <div className="flex gap-1">
                    <input type="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder={mediaType === "audio_url" ? "https://...mp3" : "https://youtube.com/watch?v=..."} className="flex-1 px-2 py-1 text-xs rounded border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]" />
                    <button onClick={() => { if (mediaUrl.trim()) onUpdateMedia?.(song.id, mediaType, mediaUrl.trim()); setEditingMediaId(null); }} className="px-2 py-1 text-xs text-white rounded" style={{ backgroundColor: "#2C3E6B" }}>Save</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Director: Add song */}
      {isDirector && (
        <div className="ml-9">
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)} className="text-xs text-[#2C3E6B] hover:text-[#2C3E6B]/80 font-medium">+ Add a song to this step</button>
          ) : (
            <div className="p-3 bg-stone-50 rounded-lg space-y-2 border border-stone-200">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Song title" className="px-2 py-1.5 text-xs rounded border border-stone-200" />
                <input type="text" value={newComposer} onChange={(e) => setNewComposer(e.target.value)} placeholder="Composer" className="px-2 py-1.5 text-xs rounded border border-stone-200" />
              </div>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded border border-stone-200">
                {songCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
              <div className="flex gap-2">
                <button onClick={() => { if (newTitle.trim()) { onAddSong?.(step.number, newTitle.trim(), newComposer.trim(), newCategory); setNewTitle(""); setNewComposer(""); setShowAddForm(false); }}} className="px-3 py-1 text-xs text-white rounded font-medium" style={{ backgroundColor: "#2C3E6B" }}>Add</button>
                <button onClick={() => setShowAddForm(false)} className="px-3 py-1 text-xs text-stone-500">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {selections.length > 0 && (
        <div className="ml-9 p-3 bg-green-50 rounded-lg">
          <p className="text-xs font-medium text-green-700">Selected: {selections.map((s) => s.songTitle).join(", ")}</p>
        </div>
      )}
    </div>
  );
}

// ─── Review Step ────────────────────────────────────────────────────────────

function FuneralReviewStep({
  details,
  selections,
  activeSteps,
  cantors,
  shareToken,
}: {
  details: FuneralDetails;
  selections: FuneralSelections;
  activeSteps: FuneralStep[];
  cantors: CantorProfile[];
  shareToken: string | null;
}) {
  const selectedCantor = cantors.find((c) => c.id === details.cantorId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">Review Your Selections</h2>
        <p className="text-sm text-muted">Review everything before saving. You can go back to any step to make changes.</p>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Service Details</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-stone-400">In Memory Of</span>
          <span className="text-stone-800 font-medium">{details.deceasedName || "Not entered"}</span>
          <span className="text-stone-400">Service Type</span>
          <span className="text-stone-800">{details.serviceType === "full_mass" ? "Full Mass" : details.serviceType === "without_eucharist" ? "Without Eucharist" : "Vigil"}</span>
          <span className="text-stone-400">Date</span>
          <span className="text-stone-800">{details.eventDate || "Not set"}{details.eventTime ? ` at ${details.eventTime}` : ""}</span>
          <span className="text-stone-400">Celebrant</span>
          <span className="text-stone-800">{details.celebrant || "Not assigned"}</span>
          <span className="text-stone-400">Cantor</span>
          <span className="text-stone-800">{selectedCantor?.display_name || "Not selected"}</span>
          <span className="text-stone-400">Contact</span>
          <span className="text-stone-800">{details.contactName || "Not entered"}</span>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Music Selections</h3>
        <div className="space-y-3">
          {activeSteps.map((step) => {
            const picks = selections[step.number] || [];
            return (
              <div key={step.number} className="flex items-start gap-3 py-2 border-b border-stone-50 last:border-0">
                <span className="text-xs font-bold text-[#2C3E6B] bg-[#2C3E6B]/10 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{step.number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-400">{step.title}</p>
                  {picks.length > 0 ? picks.map((p, i) => (
                    <p key={i} className="text-sm font-medium text-stone-800">
                      {p.songTitle}{p.composer && <span className="text-xs text-stone-400 ml-1">{p.composer}</span>}
                    </p>
                  )) : (
                    <p className="text-sm text-stone-300 italic">{step.isOptional ? "Skipped" : "Not selected"}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {shareToken && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-800 mb-1">Selections saved successfully</p>
          <p className="text-xs text-blue-700 mb-2">Share this link with the family:</p>
          <div className="flex items-center gap-2">
            <input type="text" readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/funeral/${shareToken}`} className="flex-1 px-3 py-1.5 rounded border border-blue-300 bg-white text-xs text-stone-700 font-mono" />
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/funeral/${shareToken}`)} className="px-3 py-1.5 rounded text-white text-xs font-medium" style={{ backgroundColor: "#2C3E6B" }}>Copy</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function AudioSample({ url, title }: { url: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <button onClick={toggle} className="flex items-center gap-1.5 text-xs text-[#2C3E6B] hover:text-[#2C3E6B]/80 transition-colors">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        {playing ? (<><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>) : (<polygon points="5,3 19,12 5,21" />)}
      </svg>
      <span>{title}</span>
    </button>
  );
}

function YouTubePreview({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const getVideoId = (u: string) => {
    const m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m?.[1] || null;
  };
  const videoId = getVideoId(url);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z"/></svg>
        Preview
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-stone-400">YouTube Preview</span>
        <button onClick={() => setOpen(false)} className="text-[10px] text-stone-400 hover:text-stone-600">Close</button>
      </div>
      {videoId ? (
        <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingBottom: "56.25%" }}>
          <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope" allowFullScreen title="YouTube preview" />
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 underline">Open on YouTube</a>
      )}
    </div>
  );
}

function FuneralChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "I'm here to help with any questions about the funeral liturgy music. Ask me about song choices, liturgical requirements, or anything else." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user" as const, content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/funeral/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: updated }) });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || data.error }]);
    } catch { setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I had trouble connecting. Please try again." }]); }
    finally { setLoading(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-white shadow-lg hover:opacity-90 transition-all text-sm font-medium" style={{ backgroundColor: "#2C3E6B" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        Ask a Question
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[500px] bg-white rounded-xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div>
          <p className="text-sm font-semibold text-stone-800">Funeral Music Guide</p>
          <p className="text-[10px] text-stone-400">Powered by AI</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[350px]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${msg.role === "user" ? "text-white" : "bg-stone-100 text-stone-800"}`} style={msg.role === "user" ? { backgroundColor: "#2C3E6B" } : undefined}>{msg.content}</div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-stone-100 px-3 py-2 rounded-lg text-sm text-stone-400">Thinking...</div></div>}
      </div>
      <div className="p-3 border-t border-stone-100">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about funeral music..." className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/30" />
          <button onClick={send} disabled={loading || !input.trim()} className="px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ backgroundColor: "#2C3E6B" }}>Send</button>
        </div>
      </div>
    </div>
  );
}
