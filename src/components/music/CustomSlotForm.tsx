"use client";

import { useState, useEffect, useRef } from "react";

type CustomSlotType = "song" | "reading" | "ritual_moment" | "note" | "mass_part";

interface NoteEntry {
  text: string;
  url: string;
}

interface LinkEntry {
  label: string;
  url: string;
}

interface CustomSlotFormProps {
  slotType: CustomSlotType;
  /** Pre-filled content for edit mode */
  existingContent?: Record<string, unknown>;
  existingLabel?: string;
  mode: "create" | "edit";
  onSave: (label: string, content: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

const SLOT_TYPE_LABELS: Record<CustomSlotType, string> = {
  song: "Song",
  reading: "Reading",
  ritual_moment: "Ritual Moment",
  note: "Note",
  mass_part: "Mass Part",
};

export default function CustomSlotForm({
  slotType,
  existingContent,
  existingLabel,
  mode,
  onSave,
  onCancel,
}: CustomSlotFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // --- Song form state ---
  const [songTitle, setSongTitle] = useState((existingContent?.title as string) ?? "");
  const [songComposer, setSongComposer] = useState((existingContent?.composer as string) ?? "");
  const [songBpm, setSongBpm] = useState((existingContent?.bpm as string) ?? "");
  const [songDescription, setSongDescription] = useState((existingContent?.description as string) ?? "");

  // --- Reading form state ---
  const [readingLabel, setReadingLabel] = useState(existingLabel ?? "");
  const [readingCitation, setReadingCitation] = useState((existingContent?.citation as string) ?? "");
  const [readingText, setReadingText] = useState((existingContent?.text as string) ?? "");

  // --- Ritual Moment form state ---
  const [ritualLabel, setRitualLabel] = useState(existingLabel ?? "");
  const [ritualDescription, setRitualDescription] = useState((existingContent?.description as string) ?? "");
  const [ritualNotes, setRitualNotes] = useState<NoteEntry[]>(() => {
    const existing = existingContent?.notes;
    if (Array.isArray(existing) && existing.length > 0) {
      return existing.map((n: unknown) => {
        const entry = n as { text?: string; url?: string };
        return { text: entry.text ?? "", url: entry.url ?? "" };
      });
    }
    return [{ text: "", url: "" }];
  });

  // --- Note form state ---
  const [noteText, setNoteText] = useState((existingContent?.text as string) ?? "");
  const [noteLinks, setNoteLinks] = useState<LinkEntry[]>(() => {
    const existing = existingContent?.links;
    if (Array.isArray(existing) && existing.length > 0) {
      return existing.map((l: unknown) => {
        const entry = l as { label?: string; url?: string };
        return { label: entry.label ?? "", url: entry.url ?? "" };
      });
    }
    return [];
  });
  const [noteBpm, setNoteBpm] = useState((existingContent?.bpm as string) ?? "");

  // --- Mass Part form state ---
  const [massPartName, setMassPartName] = useState(existingLabel ?? "");
  const [massPartSetting, setMassPartSetting] = useState((existingContent?.setting as string) ?? "");
  const [massPartComposer, setMassPartComposer] = useState((existingContent?.composer as string) ?? "");

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const handleSubmit = async () => {
    setError(null);
    let label = "";
    let content: Record<string, unknown> = {};

    switch (slotType) {
      case "song": {
        if (!songTitle.trim()) {
          setError("Title is required.");
          return;
        }
        label = songTitle.trim();
        content = {
          title: songTitle.trim(),
          ...(songComposer.trim() && { composer: songComposer.trim() }),
          ...(songBpm.trim() && { bpm: songBpm.trim() }),
          ...(songDescription.trim() && { description: songDescription.trim() }),
        };
        break;
      }
      case "reading": {
        if (!readingLabel.trim()) {
          setError("Label is required.");
          return;
        }
        label = readingLabel.trim();
        content = {
          ...(readingCitation.trim() && { citation: readingCitation.trim() }),
          ...(readingText.trim() && { text: readingText.trim() }),
        };
        break;
      }
      case "ritual_moment": {
        if (!ritualLabel.trim()) {
          setError("Label is required.");
          return;
        }
        label = ritualLabel.trim();
        const filteredNotes = ritualNotes.filter((n) => n.text.trim());
        content = {
          ...(ritualDescription.trim() && { description: ritualDescription.trim() }),
          ...(filteredNotes.length > 0 && {
            notes: filteredNotes.map((n) => ({
              text: n.text.trim(),
              ...(n.url.trim() && { url: n.url.trim() }),
            })),
          }),
        };
        break;
      }
      case "note": {
        if (!noteText.trim()) {
          setError("Text is required.");
          return;
        }
        label = "Note";
        const filteredLinks = noteLinks.filter((l) => l.label.trim() || l.url.trim());
        content = {
          text: noteText.trim(),
          ...(filteredLinks.length > 0 && {
            links: filteredLinks.map((l) => ({
              label: l.label.trim(),
              url: l.url.trim(),
            })),
          }),
          ...(noteBpm.trim() && { bpm: noteBpm.trim() }),
        };
        break;
      }
      case "mass_part": {
        if (!massPartName.trim()) {
          setError("Name is required.");
          return;
        }
        label = massPartName.trim();
        content = {
          name: massPartName.trim(),
          ...(massPartSetting.trim() && { setting: massPartSetting.trim() }),
          ...(massPartComposer.trim() && { composer: massPartComposer.trim() }),
        };
        break;
      }
    }

    setSaving(true);
    try {
      await onSave(label, content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      setSaving(false);
    }
  };

  const inputClass =
    "w-full text-sm border border-stone-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white";
  const labelClass =
    "block text-[10px] font-medium text-stone-500 uppercase tracking-wide mb-0.5";

  const renderForm = () => {
    switch (slotType) {
      case "song":
        return (
          <div className="space-y-2.5">
            <div>
              <label className={labelClass}>Title *</label>
              <input
                ref={firstInputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className={inputClass}
                placeholder="Song title"
              />
            </div>
            <div>
              <label className={labelClass}>Composer</label>
              <input
                type="text"
                value={songComposer}
                onChange={(e) => setSongComposer(e.target.value)}
                className={inputClass}
                placeholder="Composer / arranger"
              />
            </div>
            <div className="flex gap-2">
              <div className="w-24">
                <label className={labelClass}>BPM</label>
                <input
                  type="number"
                  value={songBpm}
                  onChange={(e) => setSongBpm(e.target.value)}
                  className={inputClass}
                  placeholder="120"
                  min="20"
                  max="300"
                />
              </div>
              <div className="flex-1">
                <label className={labelClass}>Description</label>
                <input
                  type="text"
                  value={songDescription}
                  onChange={(e) => setSongDescription(e.target.value)}
                  className={inputClass}
                  placeholder="Optional description"
                />
              </div>
            </div>
          </div>
        );

      case "reading":
        return (
          <div className="space-y-2.5">
            <div>
              <label className={labelClass}>Label *</label>
              <input
                ref={firstInputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={readingLabel}
                onChange={(e) => setReadingLabel(e.target.value)}
                className={inputClass}
                placeholder='e.g. "Sung Reading", "Canticle"'
              />
            </div>
            <div>
              <label className={labelClass}>Citation</label>
              <input
                type="text"
                value={readingCitation}
                onChange={(e) => setReadingCitation(e.target.value)}
                className={inputClass}
                placeholder="e.g. Is 12:2-6"
              />
            </div>
            <div>
              <label className={labelClass}>Text</label>
              <textarea
                value={readingText}
                onChange={(e) => setReadingText(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Reading text (optional)"
              />
            </div>
          </div>
        );

      case "ritual_moment":
        return (
          <div className="space-y-2.5">
            <div>
              <label className={labelClass}>Label *</label>
              <input
                ref={firstInputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={ritualLabel}
                onChange={(e) => setRitualLabel(e.target.value)}
                className={inputClass}
                placeholder='e.g. "Washing of the Feet", "Anointing"'
              />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={ritualDescription}
                onChange={(e) => setRitualDescription(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <div className="space-y-1.5">
                {ritualNotes.map((note, i) => (
                  <div key={i} className="flex gap-1.5 items-start">
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={note.text}
                        onChange={(e) => {
                          const updated = [...ritualNotes];
                          updated[i] = { ...updated[i], text: e.target.value };
                          setRitualNotes(updated);
                        }}
                        className={inputClass}
                        placeholder="Note text"
                      />
                      <input
                        type="url"
                        value={note.url}
                        onChange={(e) => {
                          const updated = [...ritualNotes];
                          updated[i] = { ...updated[i], url: e.target.value };
                          setRitualNotes(updated);
                        }}
                        className={`${inputClass} text-xs`}
                        placeholder="URL (optional)"
                      />
                    </div>
                    {ritualNotes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRitualNotes(ritualNotes.filter((_, j) => j !== i))}
                        className="mt-1.5 p-1 text-stone-300 hover:text-red-500 transition-colors"
                        title="Remove note"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRitualNotes([...ritualNotes, { text: "", url: "" }])}
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add note
                </button>
              </div>
            </div>
          </div>
        );

      case "note":
        return (
          <div className="space-y-2.5">
            <div>
              <label className={labelClass}>Text *</label>
              <textarea
                ref={firstInputRef as React.RefObject<HTMLTextAreaElement>}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Note content"
              />
            </div>
            <div>
              <label className={labelClass}>Links</label>
              <div className="space-y-1.5">
                {noteLinks.map((link, i) => (
                  <div key={i} className="flex gap-1.5 items-start">
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => {
                          const updated = [...noteLinks];
                          updated[i] = { ...updated[i], label: e.target.value };
                          setNoteLinks(updated);
                        }}
                        className={inputClass}
                        placeholder="Link label"
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => {
                          const updated = [...noteLinks];
                          updated[i] = { ...updated[i], url: e.target.value };
                          setNoteLinks(updated);
                        }}
                        className={`${inputClass} text-xs`}
                        placeholder="https://..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setNoteLinks(noteLinks.filter((_, j) => j !== i))}
                      className="mt-1.5 p-1 text-stone-300 hover:text-red-500 transition-colors"
                      title="Remove link"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNoteLinks([...noteLinks, { label: "", url: "" }])}
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add link
                </button>
              </div>
            </div>
            <div className="w-24">
              <label className={labelClass}>BPM</label>
              <input
                type="number"
                value={noteBpm}
                onChange={(e) => setNoteBpm(e.target.value)}
                className={inputClass}
                placeholder="120"
                min="20"
                max="300"
              />
            </div>
          </div>
        );

      case "mass_part":
        return (
          <div className="space-y-2.5">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                ref={firstInputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={massPartName}
                onChange={(e) => setMassPartName(e.target.value)}
                className={inputClass}
                placeholder='e.g. "Gloria", "Exultet", "Homily"'
              />
            </div>
            <div>
              <label className={labelClass}>Setting</label>
              <input
                type="text"
                value={massPartSetting}
                onChange={(e) => setMassPartSetting(e.target.value)}
                className={inputClass}
                placeholder="e.g. Mass of Joy and Peace"
              />
            </div>
            <div>
              <label className={labelClass}>Composer</label>
              <input
                type="text"
                value={massPartComposer}
                onChange={(e) => setMassPartComposer(e.target.value)}
                className={inputClass}
                placeholder="Composer"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onCancel} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-sm bg-white border border-stone-200 rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <h3 className="text-sm font-semibold text-stone-800">
              {mode === "create" ? "Add" : "Edit"} {SLOT_TYPE_LABELS[slotType]}
            </h3>
            <button
              onClick={onCancel}
              className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-3">
                {error}
              </p>
            )}
            {renderForm()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-stone-100">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : mode === "create" ? "Add" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
