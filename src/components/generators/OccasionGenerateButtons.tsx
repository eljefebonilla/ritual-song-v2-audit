"use client";

import { useState, useEffect, useCallback } from "react";

interface OccasionGenerateButtonsProps {
  occasionId: string;
}

interface MassEventInfo {
  massEventId: string;
  setlistId: string | null;
  parishId: string | null;
  generationStatus: string | null;
  setlistPdfUrl: string | null;
  worshipAidPdfUrl: string | null;
}

export default function OccasionGenerateButtons({
  occasionId,
}: OccasionGenerateButtonsProps) {
  const [info, setInfo] = useState<MassEventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<"setlist" | "worship-aid" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/generate/occasion-info?occasionId=${encodeURIComponent(occasionId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setInfo(null);
        } else {
          setInfo(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [occasionId]);

  const handleGenerate = useCallback(
    async (type: "setlist" | "worship-aid") => {
      if (!info?.massEventId || !info?.parishId) return;

      // If no setlist exists, open the setlist builder instead
      if (!info.setlistId) {
        window.open(`/admin/setlist/${info.massEventId}`, "_blank");
        return;
      }

      setGenerating(type);
      setError(null);

      try {
        const res = await fetch(`/api/generate/${type}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            massEventId: info.massEventId,
            parishId: info.parishId,
          }),
        });
        const data = await res.json();

        if (data.success && data.pdfUrl) {
          window.open(data.pdfUrl, "_blank");
          // Update local state with new URL
          setInfo((prev) =>
            prev
              ? {
                  ...prev,
                  ...(type === "setlist"
                    ? { setlistPdfUrl: data.pdfUrl }
                    : { worshipAidPdfUrl: data.pdfUrl }),
                  generationStatus: "ready",
                }
              : prev
          );
        } else {
          setError(data.error || "Generation failed");
        }
      } catch {
        setError("Network error");
      } finally {
        setGenerating(null);
      }
    },
    [info]
  );

  if (loading) {
    return (
      <>
        <PlaceholderButton label="Setlist PDF" />
        <PlaceholderButton label="Worship Aid" />
      </>
    );
  }

  // No mass event found for this occasion
  if (!info?.massEventId) {
    return (
      <>
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-stone-200 text-stone-400 cursor-default">
          <MusicIcon />
          Setlist PDF
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-stone-200 text-stone-400 cursor-default">
          <PrintIcon />
          Worship Aid
        </span>
      </>
    );
  }

  const hasSetlist = !!info.setlistId;

  return (
    <>
      {/* Setlist PDF */}
      {info.setlistPdfUrl && !generating ? (
        <a
          href={info.setlistPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <MusicIcon />
          Setlist PDF
        </a>
      ) : (
        <button
          onClick={() => handleGenerate("setlist")}
          disabled={generating !== null}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
        >
          <MusicIcon />
          {generating === "setlist"
            ? "Generating..."
            : hasSetlist
              ? "Generate Setlist PDF"
              : "Create Setlist"}
        </button>
      )}

      {/* Worship Aid */}
      {info.worshipAidPdfUrl && !generating ? (
        <a
          href={info.worshipAidPdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-parish-burgundy/30 text-parish-burgundy hover:bg-parish-burgundy/5 transition-colors"
        >
          <PrintIcon />
          Worship Aid
        </a>
      ) : (
        <button
          onClick={() => handleGenerate("worship-aid")}
          disabled={generating !== null || !hasSetlist}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-parish-burgundy/30 text-parish-burgundy hover:bg-parish-burgundy/5 transition-colors disabled:opacity-50"
          title={!hasSetlist ? "Create a setlist first" : undefined}
        >
          <PrintIcon />
          {generating === "worship-aid" ? "Generating..." : "Worship Aid"}
        </button>
      )}

      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </>
  );
}

function PlaceholderButton({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-stone-200 text-stone-300 animate-pulse">
      {label}
    </span>
  );
}

function MusicIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}
