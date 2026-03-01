"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SlimRecommendation {
  id: string;
  title: string;
  composer?: string;
  score: number;
  reasons: string[];
}

type PositionRecs = Record<string, SlimRecommendation[]>;

const POSITION_LABELS: Record<string, string> = {
  gathering: "Gathering",
  offertory: "Offertory",
  communion1: "Communion",
  communion2: "Communion 2",
  sending: "Sending",
  prelude: "Prelude",
  psalm: "Psalm",
  gospelAcclamation: "Gospel Accl.",
};

const DISPLAY_POSITIONS = ["gathering", "offertory", "communion1", "sending", "prelude", "psalm"];

interface OccasionRecommendationsProps {
  occasionId: string;
  seasonColor: string;
}

export default function OccasionRecommendations({ occasionId, seasonColor }: OccasionRecommendationsProps) {
  const [recs, setRecs] = useState<PositionRecs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/recommendations/${occasionId}?limit=5`)
      .then((res) => res.json())
      .then((data) => setRecs(data))
      .catch(() => setRecs(null))
      .finally(() => setLoading(false));
  }, [occasionId]);

  if (loading) {
    return (
      <div className="mb-6">
        <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">
          Recommended Songs
        </h2>
        <div className="animate-pulse text-sm text-stone-400">Loading recommendations…</div>
      </div>
    );
  }

  if (!recs) return null;

  const hasAny = DISPLAY_POSITIONS.some((pos) => recs[pos] && recs[pos].length > 0);
  if (!hasAny) return null;

  return (
    <div className="mb-6">
      <div
        className="w-12 h-1 rounded-full mb-3"
        style={{ backgroundColor: seasonColor }}
      />
      <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-3">
        Recommended Songs
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DISPLAY_POSITIONS.map((pos) => {
          const posRecs = recs[pos];
          if (!posRecs || posRecs.length === 0) return null;

          return (
            <div key={pos} className="border border-stone-200 rounded-lg p-3 bg-white">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
                {POSITION_LABELS[pos] || pos}
              </h3>
              <div className="space-y-1.5">
                {posRecs.map((rec, i) => (
                  <div key={rec.id} className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-stone-300 mt-0.5 w-3 shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/library?song=${rec.id}`}
                        className="text-xs font-medium text-stone-800 hover:text-stone-600 transition-colors"
                      >
                        {rec.title}
                      </Link>
                      {rec.composer && (
                        <span className="text-[10px] text-stone-400 ml-1">
                          {rec.composer}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {rec.reasons.slice(0, 3).map((reason, j) => (
                          <span
                            key={j}
                            className="inline-block px-1 py-0 text-[7px] font-medium rounded bg-amber-50 text-amber-600"
                          >
                            {reason}
                          </span>
                        ))}
                        <span className="text-[8px] text-stone-400">
                          {rec.score}pts
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
