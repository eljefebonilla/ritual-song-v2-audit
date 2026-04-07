"use client";

import { useState, useEffect, useCallback } from "react";

interface QueueItem {
  id: string;
  song_id: string;
  task_type: string;
  status: string;
  payload: { url?: string; reason?: string };
  created_at: string;
  song: { id: string; legacy_id: string; title: string; composer: string | null; category: string } | null;
}

export default function EnrichmentReviewPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [stats, setStats] = useState({ approved: 0, rejected: 0 });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/enrichment-queue?status=human_review&task_type=youtube_link&limit=100");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActioningId(id);
    const res = await fetch("/api/enrichment-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setStats((prev) => ({
        ...prev,
        [action === "approve" ? "approved" : "rejected"]: prev[action === "approve" ? "approved" : "rejected"] + 1,
      }));
    }
    setActioningId(null);
  };

  const approveAll = async () => {
    for (const item of items) {
      await handleAction(item.id, "approve");
    }
  };

  function extractYouTubeId(url: string): string | null {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">YouTube Link Review</h1>
          <p className="text-sm text-stone-500 mt-1">
            {items.length} pending review
            {stats.approved > 0 && ` | ${stats.approved} approved`}
            {stats.rejected > 0 && ` | ${stats.rejected} rejected`}
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={approveAll}
            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors"
          >
            Approve All ({items.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          No items pending review. All caught up.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const ytId = item.payload?.url ? extractYouTubeId(item.payload.url) : null;
            const isActioning = actioningId === item.id;

            return (
              <div
                key={item.id}
                className={`border border-stone-200 rounded-lg bg-white p-4 ${isActioning ? "opacity-50" : ""}`}
              >
                <div className="flex items-start gap-4">
                  {/* YouTube thumbnail */}
                  {ytId && (
                    <a
                      href={item.payload.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                        alt=""
                        className="w-32 h-20 rounded object-cover"
                      />
                    </a>
                  )}

                  {/* Song info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800 truncate">
                      {item.song?.title || "Unknown Song"}
                    </p>
                    <p className="text-xs text-stone-500 truncate">
                      {item.song?.composer || "Unknown"} | {item.song?.category}
                    </p>
                    {item.payload?.reason && (
                      <p className="text-xs text-stone-400 mt-1 italic line-clamp-2">
                        {item.payload.reason}
                      </p>
                    )}
                    {item.payload?.url && (
                      <a
                        href={item.payload.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 hover:underline mt-1 block truncate"
                      >
                        {item.payload.url}
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(item.id, "approve")}
                      disabled={isActioning}
                      className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100 transition-colors font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(item.id, "reject")}
                      disabled={isActioning}
                      className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
