"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type GenerationStatus = "idle" | "generating" | "ready" | "outdated" | "failed";

interface GenerateButtonProps {
  setlistId: string | null;
  parishId: string;
  /** Called after save completes to trigger generation check */
  onSaveComplete?: boolean;
}

export default function GenerateButton({
  setlistId,
  parishId,
  onSaveComplete,
}: GenerateButtonProps) {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [setlistPdfUrl, setSetlistPdfUrl] = useState<string | null>(null);
  const [worshipAidPdfUrl, setWorshipAidPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch current status on mount
  useEffect(() => {
    if (!setlistId) return;
    fetchStatus(setlistId);
  }, [setlistId]);

  // Debounced trigger after save
  useEffect(() => {
    if (!onSaveComplete || !setlistId) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Mark as outdated immediately for UI feedback
    setStatus((prev) => (prev === "ready" ? "outdated" : prev));

    debounceTimer.current = setTimeout(() => {
      triggerGeneration(setlistId);
    }, 30_000); // 30-second debounce

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [onSaveComplete, setlistId]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimer.current) clearTimeout(pollingTimer.current);
    };
  }, []);

  const fetchStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/generate/trigger?setlistId=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.generation_status || "idle");
      setGeneratedAt(data.generated_at || null);
      setSetlistPdfUrl(data.setlist_pdf_url || null);
      setWorshipAidPdfUrl(data.worship_aid_pdf_url || null);
      setError(data.generation_error || null);

      // If still generating, poll
      if (data.generation_status === "generating") {
        pollingTimer.current = setTimeout(() => fetchStatus(id), 5_000);
      }
    } catch {
      // Silently fail on status fetch
    }
  }, []);

  const triggerGeneration = useCallback(async (id: string) => {
    setStatus("generating");
    setError(null);

    try {
      const res = await fetch("/api/generate/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setlistId: id, parishId }),
      });
      const data = await res.json();

      if (!data.triggered) {
        // Not triggered (incomplete or unchanged)
        if (data.reason === "unchanged") {
          setStatus("ready");
        } else {
          setStatus("idle");
        }
        return;
      }

      if (data.success) {
        setStatus("ready");
        setGeneratedAt(new Date().toISOString());
        setSetlistPdfUrl(data.setlistPdfUrl || null);
        setWorshipAidPdfUrl(data.worshipAidPdfUrl || null);
      } else {
        setStatus("failed");
        setError(data.error || "Generation failed");
      }
    } catch {
      setStatus("failed");
      setError("Network error during generation");
    }
  }, [parishId]);

  const handleManualGenerate = useCallback(() => {
    if (!setlistId) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    triggerGeneration(setlistId);
  }, [setlistId, triggerGeneration]);

  const timeAgo = generatedAt ? formatTimeAgo(generatedAt) : null;

  return (
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      <StatusBadge status={status} timeAgo={timeAgo} error={error} />

      {/* PDF download links */}
      {status === "ready" && (
        <div className="flex items-center gap-1.5">
          {setlistPdfUrl && (
            <a
              href={setlistPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 border border-stone-300 text-stone-600 rounded hover:bg-stone-50"
            >
              Setlist PDF
            </a>
          )}
          {worshipAidPdfUrl && (
            <a
              href={worshipAidPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 border border-stone-300 text-stone-600 rounded hover:bg-stone-50"
            >
              Worship Aid
            </a>
          )}
        </div>
      )}

      {/* Regenerate button */}
      {(status === "outdated" || status === "failed" || status === "ready") && (
        <button
          onClick={handleManualGenerate}
          className="text-xs px-2.5 py-1 bg-stone-800 text-white rounded hover:bg-stone-700"
        >
          {status === "outdated" ? "Generate" : "Regenerate"}
        </button>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  timeAgo,
  error,
}: {
  status: GenerationStatus;
  timeAgo: string | null;
  error: string | null;
}) {
  switch (status) {
    case "idle":
      return null;
    case "generating":
      return (
        <span className="text-xs text-amber-600 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Generating...
        </span>
      );
    case "ready":
      return (
        <span className="text-xs text-green-600 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Ready{timeAgo ? ` (${timeAgo})` : ""}
        </span>
      );
    case "outdated":
      return (
        <span className="text-xs text-orange-500 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
          Outdated
        </span>
      );
    case "failed":
      return (
        <span className="text-xs text-red-500 flex items-center gap-1" title={error || undefined}>
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          Failed
        </span>
      );
  }
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
