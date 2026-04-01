"use client";

import { useState, useEffect } from "react";

export interface ScoredSong {
  songId: string;
  title: string;
  composer?: string;
  score: number;
  reasons: { type: string; detail: string; points: number }[];
  weeksSinceUsed: number | null;
  weeksUntilNext: number | null;
}

/**
 * Fetch runtime-powered recommendations for a specific occasion + position.
 * Uses the POST /api/recommendations/[occasionId] endpoint (Section 16 runtime).
 *
 * Usage:
 *   const { recommendations, loading } = useRecommendations("palm-sunday-c", "gathering");
 */
export function useRecommendations(
  occasionId: string | undefined,
  position: string,
  options?: { limit?: number; excludeSongIds?: string[] }
) {
  const [recommendations, setRecommendations] = useState<ScoredSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!occasionId || !position) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;

    async function fetchRecs() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/recommendations/${occasionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            position,
            limit: options?.limit ?? 8,
            excludeSongIds: options?.excludeSongIds ?? [],
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!cancelled) {
          setRecommendations(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load recommendations");
          setRecommendations([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRecs();
    return () => { cancelled = true; };
  }, [occasionId, position, options?.limit, options?.excludeSongIds?.join(",")]);

  return { recommendations, loading, error };
}
