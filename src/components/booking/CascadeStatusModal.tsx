"use client";

import { useState, useEffect, useCallback } from "react";

interface CascadeCandidate {
  id: string;
  contact_order: number;
  status: string;
  contacted_at: string | null;
  responded_at: string | null;
  profile: {
    id: string;
    full_name: string;
    instrument: string | null;
    voice_part: string | null;
  } | null;
}

interface CascadeData {
  id: string;
  status: string;
  urgency: string;
  timeout_minutes: number;
  created_at: string;
  filled_by: string | null;
  candidates: CascadeCandidate[];
}

interface CascadeStatusModalProps {
  cascadeId: string;
  onClose: () => void;
}

const STATUS_ICONS: Record<string, string> = {
  queued: "\u25CB",
  contacted: "\u25CE",
  accepted: "\u2705",
  declined: "\u274C",
  timeout: "\u23F0",
  skipped: "\u23ED",
};

const STATUS_COLORS: Record<string, string> = {
  queued: "text-stone-400",
  contacted: "text-amber-600",
  accepted: "text-green-600",
  declined: "text-red-500",
  timeout: "text-orange-500",
  skipped: "text-stone-300",
};

export default function CascadeStatusModal({
  cascadeId,
  onClose,
}: CascadeStatusModalProps) {
  const [data, setData] = useState<CascadeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/cascade?id=${cascadeId}`);
      if (!res.ok) throw new Error("Failed to fetch cascade status");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [cascadeId]);

  // Poll every 10 seconds while active
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (data?.status === "active" || data?.status === "pending") {
        fetchStatus();
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchStatus, data?.status]);

  const handleStartCascade = async () => {
    setExecuting(true);
    try {
      const res = await fetch("/api/cascade/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cascadeId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to start cascade");
      }
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExecuting(false);
    }
  };

  const handleAdvance = async () => {
    setExecuting(true);
    try {
      const res = await fetch("/api/cascade/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cascadeId }),
      });
      const json = await res.json();
      if (json.status === "skipped") {
        // Candidate was skipped, auto-advance to next
        await handleAdvance();
        return;
      }
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExecuting(false);
    }
  };

  const currentCandidate = data?.candidates.find((c) => c.status === "contacted");
  const canAdvance =
    data?.status === "active" &&
    !currentCandidate &&
    data.candidates.some((c) => c.status === "queued");
  const needsTimeout =
    currentCandidate &&
    currentCandidate.contacted_at &&
    Date.now() - new Date(currentCandidate.contacted_at).getTime() >
      (data?.timeout_minutes ?? 15) * 60_000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-stone-900">Sub Request Cascade</h2>
            {data && (
              <span
                className={`text-xs font-medium ${
                  data.status === "filled"
                    ? "text-green-600"
                    : data.status === "exhausted"
                    ? "text-red-500"
                    : data.status === "active"
                    ? "text-amber-600"
                    : "text-stone-500"
                }`}
              >
                {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
                {data.urgency === "urgent" && " (URGENT)"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {loading && (
            <p className="text-sm text-stone-500">Loading cascade status...</p>
          )}

          {error && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}

          {data && (
            <>
              {/* Candidate list */}
              <div className="space-y-1.5 mb-4">
                {data.candidates
                  .sort((a, b) => a.contact_order - b.contact_order)
                  .map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                        c.status === "contacted"
                          ? "bg-amber-50 ring-1 ring-amber-200"
                          : c.status === "accepted"
                          ? "bg-green-50 ring-1 ring-green-200"
                          : "bg-stone-50"
                      }`}
                    >
                      <span className={`text-base ${STATUS_COLORS[c.status] || "text-stone-400"}`}>
                        {STATUS_ICONS[c.status] || "\u25CB"}
                      </span>
                      <span className="font-medium text-stone-800">
                        #{c.contact_order}. {c.profile?.full_name || "Unknown"}
                      </span>
                      {c.profile?.instrument && (
                        <span className="text-xs text-stone-400">
                          ({c.profile.instrument})
                        </span>
                      )}
                      <span className="ml-auto text-xs text-stone-400">
                        {c.status}
                        {c.status === "contacted" && c.contacted_at && (
                          <> ({Math.round((Date.now() - new Date(c.contacted_at).getTime()) / 60_000)}m ago)</>
                        )}
                      </span>
                    </div>
                  ))}

                {data.candidates.length === 0 && (
                  <p className="text-sm text-stone-500">No candidates found for this role.</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {data.status === "pending" && (
                  <button
                    onClick={handleStartCascade}
                    disabled={executing || data.candidates.length === 0}
                    className="text-xs px-4 py-2 bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-50"
                  >
                    {executing ? "Sending..." : "Start Cascade"}
                  </button>
                )}

                {(canAdvance || needsTimeout) && (
                  <button
                    onClick={handleAdvance}
                    disabled={executing}
                    className="text-xs px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                  >
                    {executing ? "Sending..." : "Contact Next"}
                  </button>
                )}

                {data.status === "filled" && (
                  <p className="text-sm text-green-700 font-medium">
                    Slot filled! Sub confirmed.
                  </p>
                )}

                {data.status === "exhausted" && (
                  <p className="text-sm text-red-600 font-medium">
                    All candidates exhausted. Manual intervention needed.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
