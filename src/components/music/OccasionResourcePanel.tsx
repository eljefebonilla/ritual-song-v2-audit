"use client";

import type { OccasionResource } from "@/lib/types";
import ResourceItem from "./ResourceItem";

interface OccasionResourcePanelProps {
  resources: OccasionResource[];
  seasonColor: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  gospel_acclamation: "Gospel Acclamation",
  antiphon: "Antiphons",
  psalm: "Psalm",
};

const CATEGORY_ORDER = ["gospel_acclamation", "antiphon", "psalm"];

export default function OccasionResourcePanel({
  resources,
  seasonColor,
}: OccasionResourcePanelProps) {
  if (resources.length === 0) return null;

  // Group by category
  const grouped = new Map<string, OccasionResource[]>();
  for (const r of resources) {
    const cat = r.category || "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(r);
  }

  const sortedCategories = [...grouped.keys()].sort(
    (a, b) =>
      (CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a)) -
      (CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b))
  );

  return (
    <div className="border-l border-stone-200 p-4 space-y-4 h-full overflow-y-auto">
      <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
        Resources
      </h3>

      {sortedCategories.map((cat) => {
        const items = grouped.get(cat)!;
        return (
          <div key={cat}>
            <h4 className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">
              {CATEGORY_LABELS[cat] || cat}
            </h4>
            <div className="space-y-1.5">
              {items.map((r) => (
                <ResourceItem
                  key={r.id}
                  resource={r}
                  seasonColor={seasonColor}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
