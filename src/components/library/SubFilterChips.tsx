"use client";

interface SubFilterChipsProps {
  filters: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  counts: Record<string, number>;
}

export default function SubFilterChips({ filters, selected, onSelect, counts }: SubFilterChipsProps) {
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
