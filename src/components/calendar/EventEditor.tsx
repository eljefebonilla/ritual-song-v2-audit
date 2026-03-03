"use client";

import { useState, useEffect } from "react";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar-types";
import type { LiturgicalDay } from "@/lib/types";
import { rowToLiturgicalDay } from "@/lib/liturgical-helpers";
import { LITURGICAL_COLOR_HEX, LITURGICAL_COLOR_LABEL } from "@/lib/liturgical-colors";
import { rankLabel } from "@/lib/liturgical-helpers";

interface EventEditorProps {
  event?: CalendarEvent & { id?: string }; // existing event to edit, or undefined for new
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const EVENT_TYPES: { id: CalendarEventType; label: string }[] = [
  { id: "mass", label: "Mass" },
  { id: "rehearsal", label: "Rehearsal" },
  { id: "special", label: "Special" },
  { id: "school", label: "School" },
  { id: "sacrament", label: "Sacrament" },
  { id: "devotion", label: "Devotion" },
  { id: "holiday", label: "Holiday" },
  { id: "meeting", label: "Meeting" },
  { id: "other", label: "Other" },
];

const ENSEMBLES = [
  { id: "", label: "None (Parish-wide)" },
  { id: "Reflections", label: "Reflections" },
  { id: "Foundations", label: "Foundations" },
  { id: "Generations", label: "Generations" },
  { id: "Heritage", label: "Heritage" },
  { id: "Elevations", label: "Elevations" },
];

export default function EventEditor({ event, onSave, onDelete, onClose }: EventEditorProps) {
  const isEdit = !!event;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [title, setTitle] = useState(event?.title || "");
  const [date, setDate] = useState(event?.date || new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState(event?.startTime || "");
  const [endTime, setEndTime] = useState(event?.endTime || "");
  const [eventType, setEventType] = useState<CalendarEventType>(event?.eventType || "mass");
  const [ensemble, setEnsemble] = useState(event?.ensemble || "");
  const [celebrant, setCelebrant] = useState(event?.celebrant || "");
  const [location, setLocation] = useState(event?.location || "");
  const [notes, setNotes] = useState(event?.notes || "");
  const [sidebarNote, setSidebarNote] = useState(event?.sidebarNote || "");
  const [hasMusic, setHasMusic] = useState(event?.hasMusic ?? true);
  const [isAutoMix, setIsAutoMix] = useState(event?.isAutoMix ?? false);
  const [needsVolunteers, setNeedsVolunteers] = useState(event?.needsVolunteers ?? false);
  const [litDay, setLitDay] = useState<LiturgicalDay | null>(null);
  const [litLoading, setLitLoading] = useState(false);

  // Fetch liturgical context when date changes
  useEffect(() => {
    if (!date) { setLitDay(null); return; }
    let cancelled = false;
    setLitLoading(true);
    fetch(`/api/liturgical-days?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          const universal = data.find(
            (d: Record<string, unknown>) => d.ecclesiastical_province === "__universal__"
          );
          setLitDay(rowToLiturgicalDay(universal || data[0]));
        } else {
          setLitDay(null);
        }
      })
      .catch(() => { if (!cancelled) setLitDay(null); })
      .finally(() => { if (!cancelled) setLitLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        event_date: date,
        start_time: startTime || null,
        end_time: endTime || null,
        event_type: eventType,
        ensemble: ensemble || null,
        celebrant: celebrant || null,
        location: location || null,
        notes: notes || null,
        sidebar_note: sidebarNote || null,
        has_music: hasMusic,
        is_auto_mix: isAutoMix,
        needs_volunteers: needsVolunteers,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !confirm("Delete this event?")) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900">
            {isEdit ? "Edit Event" : "Add Event"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
              placeholder="e.g. 9:00 Mass"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          {/* Liturgical Context Card */}
          {(litDay || litLoading) && (
            <div className="p-3 rounded-lg border border-stone-200 bg-stone-50">
              <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold mb-2">
                Liturgical Context
              </p>
              {litLoading ? (
                <p className="text-xs text-stone-400">Loading...</p>
              ) : litDay ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: LITURGICAL_COLOR_HEX[litDay.colorPrimary] }}
                    />
                    <span className="text-sm font-medium text-stone-800">
                      {litDay.celebrationName}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                    <span>{rankLabel(litDay.rank)}</span>
                    <span>{LITURGICAL_COLOR_LABEL[litDay.colorPrimary]}</span>
                    <span>Gloria: {litDay.gloria ? "Yes" : "No"}</span>
                    <span>Alleluia: {litDay.alleluia ? "Yes" : "No"}</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as CalendarEventType)}
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Ensemble */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Ensemble</label>
            <select
              value={ensemble}
              onChange={(e) => setEnsemble(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              {ENSEMBLES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Celebrant */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Celebrant</label>
            <input
              type="text"
              value={celebrant}
              onChange={(e) => setCelebrant(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
              placeholder="e.g. Fr. David"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
              placeholder="e.g. Church"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none"
            />
          </div>

          {/* Sidebar Note */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Sidebar Note</label>
            <input
              type="text"
              value={sidebarNote}
              onChange={(e) => setSidebarNote(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
              placeholder="Brief annotation shown on calendar"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasMusic}
                onChange={(e) => setHasMusic(e.target.checked)}
                className="rounded border-stone-300 text-parish-burgundy focus:ring-parish-burgundy"
              />
              <span className="text-sm text-stone-700">Has live music</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAutoMix}
                onChange={(e) => setIsAutoMix(e.target.checked)}
                className="rounded border-stone-300 text-parish-burgundy focus:ring-parish-burgundy"
              />
              <span className="text-sm text-stone-700">Auto-Mix</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={needsVolunteers}
                onChange={(e) => setNeedsVolunteers(e.target.checked)}
                className="rounded border-stone-300 text-parish-burgundy focus:ring-parish-burgundy"
              />
              <span className="text-sm text-stone-700">Needs Volunteers</span>
            </label>
          </div>
        </form>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-between">
          {isEdit && onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              {deleting ? "Deleting..." : "Delete Event"}
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Event"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
