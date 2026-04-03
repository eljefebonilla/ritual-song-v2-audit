"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { BookingSlot, BookingStatus, ChoirDescriptor } from "@/lib/booking-types";
import BookingGrid from "./BookingGrid";
import SlotEditor from "./SlotEditor";
import CascadeStatusModal from "./CascadeStatusModal";

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
  ensemble: string | null;
  voice_part: string | null;
  instrument: string | null;
}

interface MassWithSlots {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  start_time_12h: string | null;
  ensemble: string | null;
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
  const [cascadeId, setCascadeId] = useState<string | null>(null);
  const [understaffedCount, setUnderstaffedCount] = useState(0);

  useEffect(() => {
    fetch("/api/staffing")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.understaffedMasses) setUnderstaffedCount(d.understaffedMasses.length); })
      .catch(() => {});
  }, []);

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

  const handleRequestSub = useCallback(
    async (
      slotId: string,
      massEventId: string,
      ministryRoleId: string,
      originalMusicianId?: string
    ) => {
      setEditor(null); // close the SlotEditor
      try {
        const res = await fetch("/api/cascade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingSlotId: slotId,
            massEventId,
            ministryRoleId,
            originalMusicianId,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          // If there's already an active cascade, show it
          if (res.status === 409 && json.cascadeId) {
            setCascadeId(json.cascadeId);
            return;
          }
          alert(json.error || "Failed to start cascade");
          return;
        }
        setCascadeId(json.cascadeId);
      } catch (err) {
        alert("Failed to start sub request. Check your connection.");
      }
    },
    []
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
          {understaffedCount > 0 && (
            <a
              href="/admin/staffing"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {understaffedCount} understaffed Mass{understaffedCount !== 1 ? "es" : ""}
            </a>
          )}
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
          massEventId={editor.massEventId}
          ministryRoleId={editor.roleId}
          onRequestSub={handleRequestSub}
        />
      )}

      {/* Cascade Status Modal */}
      {cascadeId && (
        <CascadeStatusModal
          cascadeId={cascadeId}
          onClose={() => {
            setCascadeId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
