"use client";

import type { ExpandedSongCategory } from "@/lib/types";

const MASS_PART_FILTERS: { id: ExpandedSongCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "kyrie", label: "Kyries" },
  { id: "gloria", label: "Glorias" },
  { id: "sprinkling_rite", label: "Sprinkling" },
  { id: "holy_holy", label: "Holy Holy" },
  { id: "memorial_acclamation", label: "Memorial" },
  { id: "great_amen", label: "Amen" },
  { id: "lamb_of_god", label: "Lamb of God" },
  { id: "lords_prayer", label: "Lord's Prayer" },
  { id: "sequence", label: "Sequences" },
];

const GA_FILTERS: { id: ExpandedSongCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "gospel_acclamation_refrain", label: "Refrains" },
  { id: "gospel_acclamation_verse", label: "Verses" },
];

interface SubFilterChipsProps {
  tab: "mass_parts" | "gospel_acclamations";
  selected: string;
  onSelect: (id: string) => void;
  counts: Record<string, number>;
}

export default function SubFilterChips({ tab, selected, onSelect, counts }: SubFilterChipsProps) {
  const filters = tab === "mass_parts" ? MASS_PART_FILTERS : GA_FILTERS;

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-hide">
      {filters.map((f) => {
        const count = f.id === "all" ? undefined : counts[f.id] || 0;
        const isActive = selected === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
              isActive
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
          >
            {f.label}
            {count !== undefined && (
              <span className={`ml-1 ${isActive ? "text-stone-300" : "text-stone-400"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
