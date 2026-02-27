"use client";

import type { SetlistPersonnel } from "@/lib/booking-types";

interface Props {
  personnel: SetlistPersonnel[];
  onChange: (updated: SetlistPersonnel[]) => void;
}

export default function SetlistPersonnelFooter({ personnel, onChange }: Props) {
  const left = personnel.filter((p) => p.side === "left");
  const right = personnel.filter((p) => p.side === "right");

  const updatePerson = (index: number, field: string, value: string) => {
    const updated = [...personnel];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addPerson = (side: "left" | "right") => {
    onChange([
      ...personnel,
      { person_name: "", role_label: "", side },
    ]);
  };

  const removePerson = (index: number) => {
    onChange(personnel.filter((_, i) => i !== index));
  };

  const renderColumn = (
    items: SetlistPersonnel[],
    side: "left" | "right",
    label: string
  ) => {
    // Find original indices in the full personnel array
    const indices = personnel
      .map((p, i) => (p.side === side ? i : -1))
      .filter((i) => i >= 0);

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">
            {label}
          </p>
          <button
            onClick={() => addPerson(side)}
            className="text-[10px] text-stone-400 hover:text-stone-600"
          >
            + Add
          </button>
        </div>
        <div className="space-y-1">
          {items.map((person, localIdx) => {
            const globalIdx = indices[localIdx];
            return (
              <div key={globalIdx} className="flex items-center gap-1.5 group">
                <input
                  type="text"
                  value={person.person_name}
                  onChange={(e) =>
                    updatePerson(globalIdx, "person_name", e.target.value)
                  }
                  placeholder="Name"
                  className="flex-1 text-xs border border-stone-200 rounded px-1.5 py-1 focus:border-stone-400 focus:ring-0"
                />
                <input
                  type="text"
                  value={person.role_label}
                  onChange={(e) =>
                    updatePerson(globalIdx, "role_label", e.target.value)
                  }
                  placeholder="Role"
                  className="w-32 text-xs border border-stone-200 rounded px-1.5 py-1 focus:border-stone-400 focus:ring-0"
                />
                <button
                  onClick={() => removePerson(globalIdx)}
                  className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 p-0.5"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-sm font-bold text-stone-900 mb-2">Personnel</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 border border-stone-200 rounded-lg bg-stone-50/50">
        {renderColumn(left, "left", "Instruments")}
        {renderColumn(right, "right", "Vocals / Other")}
      </div>
    </div>
  );
}
