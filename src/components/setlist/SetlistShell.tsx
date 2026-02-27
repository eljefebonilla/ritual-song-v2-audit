"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  Setlist,
  SetlistSongRow,
  SetlistPersonnel,
  SetlistSafetySong,
  BookingSlot,
  ChoirDescriptor,
} from "@/lib/booking-types";
import type { LiturgicalOccasion } from "@/lib/types";
import { bootstrapSetlist } from "@/lib/setlist-utils";
import SetlistSongRowEditor from "./SetlistSongRowEditor";
import SetlistPersonnelFooter from "./SetlistPersonnelFooter";

interface MassEvent {
  id: string;
  title: string;
  event_date: string;
  start_time_12h: string | null;
  community: string | null;
  liturgical_name: string | null;
  occasion_id: string | null;
  season: string | null;
  choir_descriptor: ChoirDescriptor | null;
  celebrant: string | null;
}

interface SetlistShellProps {
  mass: MassEvent;
  existingSetlist: Setlist | null;
  bookingSlots: BookingSlot[];
  occasion: LiturgicalOccasion | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SetlistShell({
  mass,
  existingSetlist,
  bookingSlots,
  occasion,
}: SetlistShellProps) {
  const router = useRouter();

  // Bootstrap if no existing setlist
  const bootstrapped = useMemo(
    () => bootstrapSetlist(occasion, mass.community, bookingSlots),
    [occasion, mass.community, bookingSlots]
  );

  const [songs, setSongs] = useState<SetlistSongRow[]>(
    existingSetlist?.songs || bootstrapped.songs
  );
  const [personnel, setPersonnel] = useState<SetlistPersonnel[]>(
    existingSetlist?.personnel || bootstrapped.personnel
  );
  const [occasionName, setOccasionName] = useState(
    existingSetlist?.occasion_name || bootstrapped.occasion_name || ""
  );
  const [specialDesignation, setSpecialDesignation] = useState(
    existingSetlist?.special_designation || ""
  );
  const [choirLabel, setChoirLabel] = useState(
    existingSetlist?.choir_label || mass.choir_descriptor || ""
  );
  const [safetySong, setSafetySong] = useState<SetlistSafetySong | null>(
    existingSetlist?.safety_song || null
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSongChange = useCallback(
    (index: number, updated: SetlistSongRow) => {
      setSongs((prev) => {
        const next = [...prev];
        next[index] = updated;
        return next;
      });
      setSaved(false);
    },
    []
  );

  const handleAddRow = useCallback(() => {
    const num = songs.filter((s) => s.position.startsWith("custom_")).length + 1;
    setSongs((prev) => [
      ...prev,
      {
        position: `custom_${num}`,
        label: "Custom",
        songs: [],
      },
    ]);
    setSaved(false);
  }, [songs]);

  const handleRemoveRow = useCallback((index: number) => {
    setSongs((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        mass_event_id: mass.id,
        occasion_name: occasionName || null,
        special_designation: specialDesignation || null,
        occasion_id: mass.occasion_id || null,
        songs,
        personnel,
        choir_label: choirLabel || null,
        safety_song: safetySong,
      };

      if (existingSetlist) {
        await fetch(`/api/setlists/${existingSetlist.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/setlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [
    mass,
    existingSetlist,
    occasionName,
    specialDesignation,
    songs,
    personnel,
    choirLabel,
    safetySong,
    router,
  ]);

  const handleRebootstrap = useCallback(() => {
    setSongs(bootstrapped.songs);
    setPersonnel(bootstrapped.personnel);
    setSaved(false);
  }, [bootstrapped]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-3 md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-stone-900">Setlist Builder</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {mass.liturgical_name || mass.title} — {formatDate(mass.event_date)}{" "}
              {mass.start_time_12h} {mass.community && `(${mass.community})`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {occasion && (
              <button
                onClick={handleRebootstrap}
                className="text-xs px-3 py-1.5 border border-stone-300 text-stone-600 rounded-md hover:bg-stone-50"
              >
                Re-bootstrap
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-4 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : saved ? "Saved" : "Save Setlist"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
        {/* Header metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Occasion Name
            </label>
            <input
              type="text"
              value={occasionName}
              onChange={(e) => {
                setOccasionName(e.target.value);
                setSaved(false);
              }}
              className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Special Designation
            </label>
            <input
              type="text"
              value={specialDesignation}
              onChange={(e) => {
                setSpecialDesignation(e.target.value);
                setSaved(false);
              }}
              placeholder="Catholic Schools' Week, Alumni Mass, etc."
              className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Choir Label
            </label>
            <input
              type="text"
              value={choirLabel}
              onChange={(e) => {
                setChoirLabel(e.target.value);
                setSaved(false);
              }}
              placeholder="Volunteers, SMPREP, etc."
              className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5"
            />
          </div>
        </div>

        {/* Song rows */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-stone-900">Songs</h2>
            <button
              onClick={handleAddRow}
              className="text-xs text-stone-500 hover:text-stone-700"
            >
              + Add row
            </button>
          </div>
          <div className="space-y-1">
            {songs.map((row, idx) => (
              <SetlistSongRowEditor
                key={row.position}
                row={row}
                onChange={(updated) => handleSongChange(idx, updated)}
                onRemove={
                  row.position.startsWith("custom_")
                    ? () => handleRemoveRow(idx)
                    : undefined
                }
              />
            ))}
          </div>
        </div>

        {/* Safety song */}
        <div>
          <h2 className="text-sm font-bold text-stone-900 mb-2">Safety Song</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={safetySong?.title || ""}
              onChange={(e) => {
                setSafetySong(
                  e.target.value
                    ? { ...safetySong, title: e.target.value }
                    : null
                );
                setSaved(false);
              }}
              placeholder="Title"
              className="flex-1 text-sm border border-stone-300 rounded-md px-2 py-1.5"
            />
            <input
              type="text"
              value={safetySong?.hymnal_number || ""}
              onChange={(e) => {
                setSafetySong(
                  safetySong
                    ? { ...safetySong, hymnal_number: e.target.value || undefined }
                    : null
                );
                setSaved(false);
              }}
              placeholder="#"
              className="w-20 text-sm border border-stone-300 rounded-md px-2 py-1.5"
            />
          </div>
        </div>

        {/* Personnel footer */}
        <SetlistPersonnelFooter
          personnel={personnel}
          onChange={(updated) => {
            setPersonnel(updated);
            setSaved(false);
          }}
        />
      </div>
    </div>
  );
}
