"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PUBLISHERS,
  DEFAULT_ENSEMBLE_PRESETS,
} from "@/tools/onboarding/types";
import type {
  MusicStyle,
  EnsembleSetup,
  FavoriteSongSeed,
  ParishSetupData,
} from "@/tools/onboarding/types";

// ─── Constants ──────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  "Welcome",
  "Parish Profile",
  "Resources",
  "Favorite Songs",
  "Auto-Populate",
  "Parish Personality",
  "Mass Schedule",
  "Ensembles",
  "Repetition & Launch",
];

const STYLE_OPTIONS: { value: MusicStyle; label: string; desc: string }[] = [
  { value: "traditional", label: "Traditional", desc: "Hymns, organ, choir-centered" },
  { value: "contemporary", label: "Contemporary", desc: "Praise & worship, band-led" },
  { value: "mixed", label: "A Good Mix", desc: "Varies by Mass time and season" },
];

const SONG_FUNCTIONS = [
  { key: "gathering", label: "Gathering Songs" },
  { key: "communion", label: "Communion Songs" },
  { key: "sending", label: "Sending Songs" },
];

interface SongOption {
  id: string;
  title: string;
  composer: string | null;
}

interface ParishOnboardWizardProps {
  songs: SongOption[];
  userId: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ParishOnboardWizard({ songs, userId }: ParishOnboardWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [parishId, setParishId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [diocese, setDiocese] = useState("");
  const [selectedPublishers, setSelectedPublishers] = useState<string[]>([]);
  const [selectedHymnals, setSelectedHymnals] = useState<string[]>([]);
  const [usesScreens, setUsesScreens] = useState(false);
  const [usesWorshipAids, setUsesWorshipAids] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteSongSeed[]>([]);
  const [generatePlan, setGeneratePlan] = useState(true);
  const [musicStyle, setMusicStyle] = useState<MusicStyle>("mixed");
  const [weekendMasses, setWeekendMasses] = useState(4);
  const [weekdayMasses, setWeekdayMasses] = useState(1);
  const [ensembles, setEnsembles] = useState<EnsembleSetup[]>(DEFAULT_ENSEMBLE_PRESETS.slice(0, 2));
  const [repetition, setRepetition] = useState(5);

  const totalSteps = WIZARD_STEPS.length;

  const togglePublisher = (pubId: string) => {
    setSelectedPublishers((prev) =>
      prev.includes(pubId) ? prev.filter((p) => p !== pubId) : [...prev, pubId]
    );
  };

  const toggleHymnal = (hymnal: string) => {
    setSelectedHymnals((prev) =>
      prev.includes(hymnal) ? prev.filter((h) => h !== hymnal) : [...prev, hymnal]
    );
  };

  const toggleFavorite = (song: SongOption, fn: string) => {
    setFavorites((prev) => {
      const exists = prev.find((f) => f.songTitle === song.title && f.liturgicalFunction === fn);
      if (exists) return prev.filter((f) => f !== exists);
      return [...prev, { songId: song.id, songTitle: song.title, liturgicalFunction: fn }];
    });
  };

  const addEnsemble = () => {
    setEnsembles((prev) => [
      ...prev,
      { name: "", color: "#6B7280", description: "" },
    ]);
  };

  const updateEnsemble = (i: number, field: keyof EnsembleSetup, value: string) => {
    setEnsembles((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  };

  const removeEnsemble = (i: number) => {
    setEnsembles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleLaunch = useCallback(async () => {
    setSaving(true);
    try {
      const setup: ParishSetupData = {
        name,
        location,
        diocese,
        publishers: selectedPublishers,
        hymnals: selectedHymnals,
        musicStyle,
        usesScreens,
        usesWorshipAids,
        weekendMassCount: weekendMasses,
        weekdayMassCount: weekdayMasses,
        repetitionPreference: repetition,
        ensembles: ensembles.filter((e) => e.name.trim()),
        favoriteSongs: favorites,
        generatePlan,
      };

      const res = await fetch("/api/parish/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Setup failed");
        return;
      }

      setParishId(data.parishId);

      // Generate plan if requested
      if (data.generatePlan) {
        setGenerating(true);
        await fetch("/api/parish/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parishId: data.parishId }),
        });
        setGenerating(false);
      }

      // Redirect to dashboard with welcome toast
      router.push("/?welcome=true");
    } catch (err) {
      alert("Setup failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [name, location, diocese, selectedPublishers, selectedHymnals, musicStyle, usesScreens, usesWorshipAids, weekendMasses, weekdayMasses, repetition, ensembles, favorites, generatePlan, router]);

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-parish-gold/50 focus:border-parish-gold placeholder:text-stone-400";

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Hero */}
      <div
        className="px-6 pt-8 pb-6"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, color-mix(in srgb, var(--color-parish-gold), transparent 82%), var(--color-background))",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
          Parish Setup
        </p>
        <h1 className="font-serif text-[1.75rem] font-light text-parish-charcoal mb-1">
          Welcome to Ritual Song
        </h1>
        <p className="text-sm text-muted">
          Let's set up your parish. This takes about 10 minutes.
        </p>
      </div>

      {/* Progress */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">Step {step + 1} of {totalSteps}</span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-parish-gold rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step pills */}
      <div className="px-6 py-3 flex gap-1 overflow-x-auto border-b border-border">
        {WIZARD_STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              step === i
                ? "bg-parish-gold/10 text-parish-charcoal border border-parish-gold/30"
                : "text-muted hover:text-stone-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="px-6 py-6">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-4 text-center py-8">
            <h2 className="font-serif text-2xl text-parish-charcoal">Thank you for giving Ritual Song a chance.</h2>
            <p className="text-sm text-muted max-w-md mx-auto">
              We'll learn about your parish, your music, and your preferences. Then we'll generate a complete
              liturgical plan so you can hit the ground running.
            </p>
            <p className="text-xs text-stone-400">Click Continue to get started.</p>
          </div>
        )}

        {/* Step 1: Parish Profile */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">Your Parish</h2>
              <p className="text-sm text-muted">Tell us about your community.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Parish Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="St. Mary Catholic Church" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Location</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Diocese / Archdiocese</label>
                <input type="text" value={diocese} onChange={(e) => setDiocese(e.target.value)} placeholder="Archdiocese of Los Angeles" className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Resources */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">Music Resources</h2>
              <p className="text-sm text-muted">What are your main publishers and hymnals?</p>
            </div>
            <div className="space-y-3">
              {PUBLISHERS.map((pub) => (
                <div key={pub.id}>
                  <button
                    onClick={() => togglePublisher(pub.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      selectedPublishers.includes(pub.id)
                        ? "border-parish-gold bg-parish-gold/5"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <span className="font-medium text-sm">{pub.name}</span>
                  </button>
                  {selectedPublishers.includes(pub.id) && (
                    <div className="ml-4 mt-2 flex flex-wrap gap-2">
                      {pub.hymnals.map((h) => (
                        <button
                          key={h}
                          onClick={() => toggleHymnal(h)}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            selectedHymnals.includes(h)
                              ? "border-parish-gold bg-parish-gold/10 text-parish-charcoal"
                              : "border-stone-200 text-stone-600"
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={usesScreens} onChange={(e) => setUsesScreens(e.target.checked)} className="rounded border-stone-300" />
                <span className="text-sm text-stone-700">We use screens (ProPresenter, EasyWorship, etc.)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={usesWorshipAids} onChange={(e) => setUsesWorshipAids(e.target.checked)} className="rounded border-stone-300" />
                <span className="text-sm text-stone-700">We print worship aids / bulletins</span>
              </label>
            </div>
          </div>
        )}

        {/* Step 3: Favorite Songs */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">Community Favorites</h2>
              <p className="text-sm text-muted">Pick songs your community loves. This helps us make better suggestions.</p>
            </div>
            {SONG_FUNCTIONS.map(({ key, label }) => {
              const selected = favorites.filter((f) => f.liturgicalFunction === key);
              return (
                <div key={key}>
                  <h3 className="text-sm font-medium text-stone-800 mb-1">
                    {label}
                    {selected.length > 0 && <span className="ml-2 text-xs text-parish-gold">({selected.length} selected)</span>}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                    {songs.slice(0, 60).map((song) => {
                      const isSel = selected.some((f) => f.songTitle === song.title);
                      return (
                        <button
                          key={song.id + key}
                          onClick={() => toggleFavorite(song, key)}
                          className={`text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                            isSel
                              ? "bg-parish-gold/10 border border-parish-gold/30 text-parish-charcoal"
                              : "bg-stone-50 border border-stone-200 text-stone-700 hover:bg-stone-100"
                          }`}
                        >
                          {song.title}
                          {song.composer && <span className="text-muted ml-1">({song.composer})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Step 4: Auto-Populate */}
        {step === 4 && (
          <div className="space-y-6 text-center py-8">
            <h2 className="font-serif text-lg font-semibold text-parish-charcoal">
              Auto-Populate Your Plan?
            </h2>
            <p className="text-sm text-muted max-w-md mx-auto">
              Would you like us to populate song selections based on the readings and your community's favorites?
              You can change any of it later. This just gives you a running start.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setGeneratePlan(true)}
                className={`px-6 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  generatePlan ? "border-parish-gold bg-parish-gold/10" : "border-stone-200"
                }`}
              >
                Yes, generate my plan
              </button>
              <button
                onClick={() => setGeneratePlan(false)}
                className={`px-6 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  !generatePlan ? "border-parish-gold bg-parish-gold/10" : "border-stone-200"
                }`}
              >
                No, I'll do it manually
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Parish Personality */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">Parish Personality</h2>
              <p className="text-sm text-muted">How would you describe your parish's music?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMusicStyle(opt.value)}
                  className={`text-left p-4 rounded-lg border-2 transition-colors ${
                    musicStyle === opt.value
                      ? "border-parish-gold bg-parish-gold/5"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  <span className="block font-medium text-sm">{opt.label}</span>
                  <span className="block text-xs text-muted mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Mass Schedule */}
        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">Mass Schedule</h2>
              <p className="text-sm text-muted">How many Masses does your parish celebrate?</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Weekend Masses (with music)</label>
                <input type="number" min={1} max={10} value={weekendMasses} onChange={(e) => setWeekendMasses(parseInt(e.target.value) || 1)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Weekday Masses (with music)</label>
                <input type="number" min={0} max={7} value={weekdayMasses} onChange={(e) => setWeekdayMasses(parseInt(e.target.value) || 0)} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Ensembles */}
        {step === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">Ensembles</h2>
              <p className="text-sm text-muted">Name your ensembles by mass time or style. Assign a color for the calendar.</p>
            </div>
            <div className="space-y-3">
              {ensembles.map((ens, i) => (
                <div key={i} className="flex items-center gap-3 bg-stone-50 rounded-lg p-3">
                  <input
                    type="color"
                    value={ens.color}
                    onChange={(e) => updateEnsemble(i, "color", e.target.value)}
                    className="w-8 h-8 rounded border border-stone-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={ens.name}
                    onChange={(e) => updateEnsemble(i, "name", e.target.value)}
                    placeholder="e.g. 9:00am Traditional"
                    className="flex-1 px-3 py-1.5 rounded border border-stone-300 text-sm"
                  />
                  <input
                    type="text"
                    value={ens.description || ""}
                    onChange={(e) => updateEnsemble(i, "description", e.target.value)}
                    placeholder="Description"
                    className="flex-1 px-3 py-1.5 rounded border border-stone-300 text-sm"
                  />
                  <button
                    onClick={() => removeEnsemble(i)}
                    className="text-stone-400 hover:text-red-500 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addEnsemble}
              className="text-xs text-parish-gold hover:text-parish-gold/80 font-medium"
            >
              + Add Ensemble
            </button>
          </div>
        )}

        {/* Step 8: Repetition & Launch */}
        {step === 8 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-lg font-semibold text-parish-charcoal mb-1">Repetition & Launch</h2>
              <p className="text-sm text-muted">
                How much should songs repeat? If people aren't singing along, a higher setting helps them learn.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Maximum variety</span>
                <span>Maximum repetition</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={repetition}
                onChange={(e) => setRepetition(parseInt(e.target.value))}
                className="w-full accent-parish-gold"
              />
              <p className="text-center text-sm font-medium text-parish-charcoal">
                {repetition <= 3 ? "High variety: your community hears many different songs" :
                 repetition <= 6 ? "Balanced: familiar favorites with regular new discoveries" :
                 "High repetition: songs repeat often so people learn them well"}
              </p>
            </div>

            {/* Summary */}
            <div className="bg-stone-50 rounded-lg p-4 mt-6">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Setup Summary</h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-stone-500">Parish</dt><dd className="text-stone-900 font-medium">{name || "Not set"}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">Publishers</dt><dd className="text-stone-900">{selectedPublishers.length > 0 ? selectedPublishers.join(", ") : "None"}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">Style</dt><dd className="text-stone-900 capitalize">{musicStyle}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">Masses</dt><dd className="text-stone-900">{weekendMasses} weekend, {weekdayMasses} weekday</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">Ensembles</dt><dd className="text-stone-900">{ensembles.filter((e) => e.name).length}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">Favorites</dt><dd className="text-stone-900">{favorites.length} songs</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">Auto-plan</dt><dd className="text-stone-900">{generatePlan ? "3-year cycle" : "Manual"}</dd></div>
              </dl>
            </div>

            {(saving || generating) && (
              <div className="text-center py-4">
                <p className="text-sm text-parish-gold font-medium">
                  {generating ? "Generating your 3-year plan..." : "Setting up your parish..."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 font-medium text-sm hover:bg-stone-50 transition-colors disabled:opacity-30"
        >
          Back
        </button>
        {step < totalSteps - 1 ? (
          <button
            onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
            className="px-4 py-2 rounded-lg bg-parish-burgundy text-white font-medium text-sm hover:bg-parish-burgundy/90 transition-colors"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleLaunch}
            disabled={saving || generating || !name}
            className="px-6 py-2 rounded-lg bg-parish-burgundy text-white font-medium text-sm hover:bg-parish-burgundy/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Setting up..." : generating ? "Generating plan..." : "Launch Parish"}
          </button>
        )}
      </div>
    </div>
  );
}
