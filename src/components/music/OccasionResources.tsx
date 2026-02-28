"use client";

import type { OccasionResource } from "@/lib/types";
import ResourceItem from "./ResourceItem";

export default function OccasionResources({
  resources,
  seasonColor,
}: {
  resources: OccasionResource[];
  seasonColor: string;
}) {
  if (!resources || resources.length === 0) return null;

  const gaResources = resources.filter(
    (r) => r.category === "gospel_acclamation"
  );
  const antiphonResources = resources.filter(
    (r) => r.category === "antiphon"
  );

  return (
    <div className="mb-6">
      <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-3">
        Music Resources
      </h2>

      {gaResources.length > 0 && (
        <div className="mb-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">
            Gospel Acclamation
          </h3>
          <div className="space-y-1.5">
            {gaResources.map((r) => (
              <ResourceItem
                key={r.id}
                resource={r}
                seasonColor={seasonColor}
              />
            ))}
          </div>
        </div>
      )}

      {antiphonResources.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">
            Antiphons
          </h3>
          <div className="space-y-1.5">
            {antiphonResources.map((r) => (
              <ResourceItem
                key={r.id}
                resource={r}
                seasonColor={seasonColor}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
