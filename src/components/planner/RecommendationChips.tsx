"use client";

import { useState, useEffect } from "react";

interface SlimRecommendation {
  id: string;
  title: string;
  composer?: string;
  score: number;
  reasons: string[];
}

interface RecommendationChipsProps {
  occasionId: string;
  position: string;
  onSelect?: (title: string, composer?: string) => void;
}

/**
 * Collapsible recommendation suggestions for a planner slot.
 * Fetches from /api/recommendations/[occasionId] and shows top matches for the position.
 */
export default function RecommendationChips({ occasionId, position, onSelect }: RecommendationChipsProps) {
  const [expanded, setExpanded] = useState(false);
  const [recs, setRecs] = useState<SlimRecommendation[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded || recs !== null) return;

    setLoading(true);
    fetch(`/api/recommendations/${occasionId}?limit=5`)
      .then((res) => res.json())
      .then((data) => {
        setRecs(data[position] || []);
      })
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [expanded, occasionId, position, recs]);

  return (
    <div className="mt-0.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[9px] font-medium text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-0.5"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Suggestions
      </button>

      {expanded && (
        <div className="mt-1 space-y-0.5">
          {loading && (
            <span className="text-[9px] text-stone-400 animate-pulse">Loading…</span>
          )}
          {recs && recs.length === 0 && (
            <span className="text-[9px] text-stone-400 italic">No suggestions</span>
          )}
          {recs?.map((rec) => (
            <button
              key={rec.id}
              onClick={() => onSelect?.(rec.title, rec.composer)}
              className="w-full text-left px-1.5 py-1 rounded bg-stone-50 hover:bg-stone-100 transition-colors group"
            >
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-medium text-stone-700 group-hover:text-stone-900 truncate flex-1">
                  {rec.title}
                </span>
                <span className="text-[8px] text-stone-400 shrink-0">
                  {rec.score}
                </span>
              </div>
              {rec.composer && (
                <span className="text-[9px] text-stone-400 truncate block">
                  {rec.composer}
                </span>
              )}
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {rec.reasons.slice(0, 3).map((reason, i) => (
                  <span
                    key={i}
                    className="inline-block px-1 py-0 text-[7px] font-medium rounded bg-amber-50 text-amber-600"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
