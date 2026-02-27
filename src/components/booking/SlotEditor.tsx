"use client";

import { useState } from "react";
import type { BookingSlot, ConfirmationStatus } from "@/lib/booking-types";

interface ProfileOption {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  community: string | null;
  voice_part: string | null;
  instrument: string | null;
}

interface SlotEditorProps {
  roleName: string;
  slot?: BookingSlot;
  profiles: ProfileOption[];
  saving: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const CONFIRMATION_OPTIONS: { value: ConfirmationStatus; label: string }[] = [
  { value: "unconfirmed", label: "Unconfirmed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "expected", label: "Expected (recurring)" },
  { value: "declined", label: "Declined" },
  { value: "auto", label: "AUTO" },
];

export default function SlotEditor({
  roleName,
  slot,
  profiles,
  saving,
  onSave,
  onDelete,
  onClose,
}: SlotEditorProps) {
  const [profileId, setProfileId] = useState(slot?.profile_id || "");
  const [personName, setPersonName] = useState(slot?.person_name || "");
  const [confirmation, setConfirmation] = useState<ConfirmationStatus>(
    slot?.confirmation as ConfirmationStatus || "unconfirmed"
  );
  const [isRecurring, setIsRecurring] = useState(slot?.is_recurring ?? false);
  const [roleLabelOverride, setRoleLabelOverride] = useState(
    slot?.role_label_override || ""
  );
  const [instrumentDetail, setInstrumentDetail] = useState(
    slot?.instrument_detail || ""
  );
  const [notes, setNotes] = useState(slot?.notes || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      profile_id: profileId || null,
      person_name: personName || null,
      confirmation,
      is_recurring: isRecurring,
      role_label_override: roleLabelOverride || null,
      instrument_detail: instrumentDetail || null,
      notes: notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900">
            {slot ? "Edit" : "Add"} — {roleName}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Person selection */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Person (select or type name)
            </label>
            <select
              value={profileId}
              onChange={(e) => {
                setProfileId(e.target.value);
                if (e.target.value) setPersonName("");
              }}
              className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5 mb-1.5"
            >
              <option value="">-- Custom name --</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                  {p.instrument ? ` (${p.instrument})` : ""}
                  {p.voice_part ? ` — ${p.voice_part}` : ""}
                </option>
              ))}
            </select>
            {!profileId && (
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Guest name, TBD Student, etc."
                className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5"
              />
            )}
          </div>

          {/* Confirmation */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Confirmation
            </label>
            <select
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value as ConfirmationStatus)}
              className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5"
            >
              {CONFIRMATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Recurring toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="rounded border-stone-300"
            />
            <span className="text-xs text-stone-600">
              Recurring assignment (auto-copy to next week)
            </span>
          </label>

          {/* Role label override */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Setlist role label{" "}
              <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={roleLabelOverride}
              onChange={(e) => setRoleLabelOverride(e.target.value)}
              placeholder={`Default: ${roleName}`}
              className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5"
            />
          </div>

          {/* Instrument detail (for "Other" role) */}
          {roleName === "Other" && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Instrument
              </label>
              <input
                type="text"
                value={instrumentDetail}
                onChange={(e) => setInstrumentDetail(e.target.value)}
                placeholder="Violin, Woodwinds, etc."
                className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Notes{" "}
              <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note"
              className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={saving}
                  className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs px-3 py-1.5 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="text-xs px-3 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : slot ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
