"use client";

import { Fragment, useState } from "react";
import type { BookingSlot, BookingStatus, ChoirDescriptor } from "@/lib/booking-types";
import { getEnsembleColor } from "@/lib/calendar-utils";
import { CONFIRMATION_DISPLAY } from "@/lib/booking-types";
import type { ConfirmationStatus } from "@/lib/booking-types";
import MassComments from "@/components/comments/MassComments";

interface MinistryRole {
  id: string;
  name: string;
  sort_order: number;
}

interface MassWithSlots {
  id: string;
  title: string;
  event_date: string;
  start_time_12h: string | null;
  ensemble: string | null;
  celebrant: string | null;
  liturgical_name: string | null;
  season: string | null;
  booking_status: BookingStatus | null;
  choir_descriptor: ChoirDescriptor | null;
  day_of_week: string | null;
  booking_slots: BookingSlot[];
}

interface BookingGridProps {
  masses: MassWithSlots[];
  roles: MinistryRole[];
  onCellClick: (massEventId: string, roleId: string, roleName: string, slot?: BookingSlot) => void;
  onStatusChange: (massId: string, field: string, value: string) => void;
}

const STATUS_OPTIONS: { value: BookingStatus; label: string; color: string }[] = [
  { value: "confirmed", label: "Confirmed", color: "bg-green-100 text-green-700" },
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  { value: "needs_attention", label: "Needs Attn", color: "bg-red-100 text-red-700" },
  { value: "na", label: "N/A", color: "bg-stone-100 text-stone-500" },
];

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SlotDisplay({ slot }: { slot: BookingSlot }) {
  const name = slot.profile?.full_name || slot.person_name || "";
  const conf = CONFIRMATION_DISPLAY[slot.confirmation as ConfirmationStatus] || "";
  const detail = slot.instrument_detail ? ` (${slot.instrument_detail})` : "";

  return (
    <div className="flex items-center gap-1 text-xs leading-tight">
      {conf && <span className="shrink-0">{conf}</span>}
      <span
        className={
          slot.confirmation === "declined"
            ? "line-through text-stone-400"
            : "text-stone-700"
        }
      >
        {name}{detail}
      </span>
    </div>
  );
}

export default function BookingGrid({
  masses,
  roles,
  onCellClick,
  onStatusChange,
}: BookingGridProps) {
  const [commentMassId, setCommentMassId] = useState<string | null>(null);
  const totalCols = 2 + roles.length; // mass info + status + role columns

  if (masses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400">
        <p className="text-sm">No masses found for this date range</p>
      </div>
    );
  }

  return (
    <div className="min-w-max">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10 bg-stone-50">
          <tr>
            <th className="sticky left-0 z-20 bg-stone-50 text-left px-2 py-2 border-b border-r border-stone-200 font-semibold text-stone-500 uppercase tracking-wide min-w-[180px]">
              Mass
            </th>
            <th className="px-2 py-2 border-b border-r border-stone-200 font-semibold text-stone-500 uppercase tracking-wide min-w-[80px]">
              Status
            </th>
            {roles.map((role) => (
              <th
                key={role.id}
                className="px-2 py-2 border-b border-r border-stone-200 font-semibold text-stone-500 uppercase tracking-wide min-w-[110px] text-left"
              >
                {role.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {masses.map((mass) => {
            const ensembleStyle = getEnsembleColor(mass.ensemble);
            // Index slots by role id
            const slotsByRole = new Map<string, BookingSlot[]>();
            for (const slot of mass.booking_slots || []) {
              const roleId = slot.ministry_role_id;
              const list = slotsByRole.get(roleId) || [];
              list.push(slot);
              slotsByRole.set(roleId, list);
            }

            return (
              <Fragment key={mass.id}>
              <tr
                className="border-b border-stone-100 hover:bg-stone-50/50"
              >
                {/* Mass info (frozen column) */}
                <td className="sticky left-0 z-10 bg-white px-2 py-2 border-r border-stone-200">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-stone-900 text-xs">
                        {formatShortDate(mass.event_date)}
                      </span>
                      <span className="text-stone-400 tabular-nums">
                        {mass.start_time_12h}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-stone-600 truncate max-w-[120px]">
                        {mass.liturgical_name || mass.title}
                      </span>
                      {mass.ensemble && (
                        <span
                          className="text-[9px] px-1 py-0.5 rounded font-medium"
                          style={ensembleStyle}
                        >
                          {mass.ensemble}
                        </span>
                      )}
                    </div>
                    {mass.celebrant && (
                      <span className="text-[10px] text-stone-400">
                        {mass.celebrant}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCommentMassId(commentMassId === mass.id ? null : mass.id);
                      }}
                      className={`mt-0.5 inline-flex items-center gap-0.5 text-[10px] transition-colors ${
                        commentMassId === mass.id
                          ? "text-stone-700"
                          : "text-stone-300 hover:text-stone-500"
                      }`}
                      title="Comments"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      notes
                    </button>
                  </div>
                </td>

                {/* Booking status */}
                <td className="px-2 py-2 border-r border-stone-200">
                  <select
                    value={mass.booking_status || "pending"}
                    onChange={(e) =>
                      onStatusChange(mass.id, "booking_status", e.target.value)
                    }
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium border-0 cursor-pointer ${
                      STATUS_OPTIONS.find(
                        (s) => s.value === (mass.booking_status || "pending")
                      )?.color || "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Role cells */}
                {roles.map((role) => {
                  const slots = slotsByRole.get(role.id) || [];
                  const sorted = [...slots].sort(
                    (a, b) => a.slot_order - b.slot_order
                  );

                  return (
                    <td
                      key={role.id}
                      className="px-2 py-1.5 border-r border-stone-200 cursor-pointer hover:bg-parish-gold/5 transition-colors"
                      onClick={() => {
                        if (sorted.length === 1) {
                          onCellClick(mass.id, role.id, role.name, sorted[0]);
                        } else {
                          onCellClick(mass.id, role.id, role.name);
                        }
                      }}
                    >
                      {sorted.length > 0 ? (
                        <div className="space-y-0.5">
                          {sorted.map((slot) => (
                            <SlotDisplay key={slot.id} slot={slot} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-stone-300">--</span>
                      )}
                    </td>
                  );
                })}
              </tr>
              {/* Comment expansion row */}
              {commentMassId === mass.id && (
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  <td
                    colSpan={totalCols}
                    className="px-4 py-3"
                  >
                    <div className="max-w-lg">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 mb-2">
                        Notes &amp; Comments
                      </p>
                      <MassComments massEventId={mass.id} />
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
