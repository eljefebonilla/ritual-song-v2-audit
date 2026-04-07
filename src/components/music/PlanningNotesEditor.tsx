"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@/lib/user-context";

interface PlanningNotesEditorProps {
  occasionId: string;
  initialNotes: string[];
}

export default function PlanningNotesEditor({ occasionId, initialNotes }: PlanningNotesEditorProps) {
  const { isAdmin } = useUser();
  const [notes, setNotes] = useState<string[]>(initialNotes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load overrides from Supabase on mount
  useEffect(() => {
    fetch(`/api/occasions/${occasionId}/music-plan`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const override = data?.["_occasion"]?.planningNotes;
        if (Array.isArray(override)) {
          setNotes(override);
        }
      })
      .catch(() => {});
  }, [occasionId]);

  const startEditing = () => {
    setDraft(notes.join("\n"));
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const save = async () => {
    setSaving(true);
    const newNotes = draft.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/occasions/${occasionId}/music-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensembleId: "_occasion",
          field: "planningNotes",
          value: newNotes,
        }),
      });
      if (res.ok) {
        setNotes(newNotes);
        setEditing(false);
      }
    } catch {}
    setSaving(false);
  };

  const cancel = () => {
    setEditing(false);
    setDraft("");
  };

  if (notes.length === 0 && !isAdmin) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] uppercase tracking-widest font-medium text-muted">
          Planning Notes
        </h2>
        {isAdmin && !editing && (
          <button
            onClick={startEditing}
            className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
          >
            {notes.length > 0 ? "Edit" : "+ Add Notes"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="border border-amber-300 rounded-lg p-3 bg-amber-50/30">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="One note per line..."
            rows={4}
            className="w-full text-sm text-stone-700 bg-transparent border-none outline-none resize-y placeholder:text-stone-300"
          />
          <div className="flex items-center gap-2 mt-2 justify-end">
            <button
              onClick={cancel}
              className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-xs bg-stone-800 text-white px-3 py-1 rounded hover:bg-stone-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : notes.length > 0 ? (
        <div
          className={`border border-stone-200 rounded-lg p-3 bg-white ${isAdmin ? "cursor-pointer hover:border-stone-300 transition-colors" : ""}`}
          onClick={isAdmin ? startEditing : undefined}
        >
          {notes.map((note, i) => (
            <p key={i} className="text-sm text-stone-600">
              {note}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
