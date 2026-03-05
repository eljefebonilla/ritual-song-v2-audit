"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  { value: "mass", label: "Mass" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "special", label: "Special" },
  { value: "school", label: "School" },
  { value: "sacrament", label: "Sacrament" },
  { value: "devotion", label: "Devotion" },
  { value: "holiday", label: "Holiday" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
];

const ENSEMBLES = [
  { value: "", label: "None" },
  { value: "Reflections", label: "Reflections" },
  { value: "Foundations", label: "Foundations" },
  { value: "Generations", label: "Generations" },
  { value: "Heritage", label: "Heritage" },
  { value: "Elevations", label: "Elevations" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function to24h(time12h: string): string | null {
  if (!time12h) return null;
  const match = time12h.match(/^(\d{1,2}):(\d{2})\s*(am|pm|a|p)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toLowerCase();
  if (period.startsWith("p") && h !== 12) h += 12;
  if (period.startsWith("a") && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EventCreatorModalProps {
  date: string;
  onClose: () => void;
}

export default function EventCreatorModal({
  date,
  onClose,
}: EventCreatorModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventType, setEventType] = useState("mass");
  const [ensemble, setEnsemble] = useState("");
  const [celebrant, setCelebrant] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Focus title on mount
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose]
  );

  // Save
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError("");

    const start24 = to24h(startTime);
    const end24 = to24h(endTime);

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          event_date: date,
          start_time: start24,
          end_time: end24,
          start_time_12h: startTime || null,
          end_time_12h: endTime || null,
          event_type: eventType,
          ensemble: ensemble || null,
          celebrant: celebrant || null,
          location: location || null,
          notes: notes || null,
          day_of_week: getDayOfWeek(date),
          has_music: eventType === "mass",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }

      onClose();
      // Reload to show new event
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [title, startTime, endTime, eventType, ensemble, celebrant, location, notes, date, onClose]);

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
    >
      <div className="mx-4 w-full max-w-lg rounded-xl border border-stone-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-light text-stone-700">
              New Event
            </h2>
            <p className="mt-0.5 text-xs text-stone-400">
              {formatDateDisplay(date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">
              Title
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vigil Mass"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">
                Start Time
              </label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="5:30pm"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">
                End Time
              </label>
              <input
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="6:30pm"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Type + Ensemble row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">
                Event Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-stone-400 focus:bg-white focus:outline-none"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">
                Ensemble
              </label>
              <select
                value={ensemble}
                onChange={(e) => setEnsemble(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-stone-400 focus:bg-white focus:outline-none"
              >
                {ENSEMBLES.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Celebrant + Location row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">
                Celebrant
              </label>
              <input
                type="text"
                value={celebrant}
                onChange={(e) => setCelebrant(e.target.value)}
                placeholder="Fr. David"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Church"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs font-medium text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-stone-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-stone-800 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  );
}
