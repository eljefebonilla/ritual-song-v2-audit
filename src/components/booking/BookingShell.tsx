"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BookingSlot, BookingStatus, ChoirDescriptor } from "@/lib/booking-types";
import BookingGrid from "./BookingGrid";
import SlotEditor from "./SlotEditor";

interface MinistryRole {
  id: string;
  name: string;
  sort_order: number;
}

interface ProfileOption {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  community: string | null;
  voice_part: string | null;
  instrument: string | null;
}

interface MassWithSlots {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  start_time_12h: string | null;
  community: string | null;
  celebrant: string | null;
  liturgical_name: string | null;
  occasion_id: string | null;
  season: string | null;
  booking_status: BookingStatus | null;
  choir_descriptor: ChoirDescriptor | null;
  has_music: boolean;
  day_of_week: string | null;
  booking_slots: BookingSlot[];
}

interface BookingShellProps {
  initialMasses: MassWithSlots[];
  roles: MinistryRole[];
  profiles: ProfileOption[];
  initialFrom: string;
  initialTo: string;
}

interface EditorState {
  massEventId: string;
  roleId: string;
  roleName: string;
  slot?: BookingSlot;
}

export default function BookingShell({
  initialMasses,
  roles,
  profiles,
  initialFrom,
  initialTo,
}: BookingShellProps) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  // Booking grid columns — filter to the ones used in the booking spreadsheet
  const gridRoles = roles.filter((r) =>
    [
      "Director",
      "Cantor",
      "Sound",
      "Playback",
      "Piano",
      "Soprano",
      "Alto",
      "Tenor",
      "Bass (Vocal)",
      "A. Guitar",
      "E. Guitar",
      "E. Bass",
      "Drums/Percussion",
      "Other",
      "Livestream TD",
    ].includes(r.name)
  );

  const handleCellClick = useCallback(
    (massEventId: string, roleId: string, roleName: string, slot?: BookingSlot) => {
      setEditor({ massEventId, roleId, roleName, slot });
    },
    []
  );

  const handleSave = useCallback(
    async (data: Record<string, unknown>) => {
      setSaving(true);
      try {
        if (editor?.slot) {
          // Update existing slot
          await fetch(`/api/booking-slots/${editor.slot.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
        } else {
          // Create new slot
          await fetch("/api/booking-slots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mass_event_id: editor?.massEventId,
              ministry_role_id: editor?.roleId,
              ...data,
            }),
          });
        }
        setEditor(null);
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [editor, router]
  );

  const handleDelete = useCallback(
    async (slotId: string) => {
      setSaving(true);
      try {
        await fetch(`/api/booking-slots/${slotId}`, { method: "DELETE" });
        setEditor(null);
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  const handleStatusChange = useCallback(
    async (massId: string, field: string, value: string) => {
      await fetch(`/api/calendar/${massId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      router.refresh();
    },
    [router]
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-3 md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-stone-900">Booking Grid</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {initialFrom} to {initialTo}
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <BookingGrid
          masses={initialMasses}
          roles={gridRoles}
          onCellClick={handleCellClick}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Slot Editor Modal */}
      {editor && (
        <SlotEditor
          roleName={editor.roleName}
          slot={editor.slot}
          profiles={profiles}
          saving={saving}
          onSave={handleSave}
          onDelete={editor.slot ? () => handleDelete(editor.slot!.id) : undefined}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
