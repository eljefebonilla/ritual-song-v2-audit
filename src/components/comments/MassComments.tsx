"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/lib/user-context";
import type { MassComment } from "@/lib/booking-types";

interface MassCommentsProps {
  massEventId: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function MassComments({ massEventId }: MassCommentsProps) {
  const { user, isAdmin } = useUser();
  const [comments, setComments] = useState<MassComment[]>([]);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchComments = useCallback(async () => {
    const res = await fetch(
      `/api/mass-comments?mass_event_id=${massEventId}`
    );
    if (res.ok) {
      const data = await res.json();
      setComments(data);
    }
    setLoading(false);
  }, [massEventId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    const res = await fetch("/api/mass-comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mass_event_id: massEventId, body: body.trim() }),
    });
    if (res.ok) {
      setBody("");
      fetchComments();
    }
    setPosting(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editBody.trim()) return;
    await fetch(`/api/mass-comments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody.trim() }),
    });
    setEditingId(null);
    fetchComments();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/mass-comments/${id}`, { method: "DELETE" });
    fetchComments();
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await fetch(`/api/mass-comments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned: !pinned }),
    });
    fetchComments();
  };

  if (loading) {
    return (
      <div className="text-xs text-stone-400 py-2">Loading comments...</div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Comment list */}
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((c) => (
            <div
              key={c.id}
              className={`flex gap-2 ${c.is_pinned ? "bg-amber-50/50 rounded px-2 py-1.5 -mx-2" : ""}`}
            >
              {/* Avatar placeholder */}
              <div className="w-6 h-6 rounded-full bg-stone-200 shrink-0 flex items-center justify-center text-[10px] text-stone-500 font-medium mt-0.5">
                {c.author?.full_name?.charAt(0) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-stone-700">
                    {c.author?.full_name || "Unknown"}
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {timeAgo(c.created_at)}
                  </span>
                  {c.is_pinned && (
                    <span className="text-[10px] text-amber-600">pinned</span>
                  )}
                </div>

                {editingId === c.id ? (
                  <div className="mt-1 flex gap-1">
                    <input
                      type="text"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleUpdate(c.id)
                      }
                      className="flex-1 text-xs border border-stone-300 rounded px-1.5 py-1"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdate(c.id)}
                      className="text-[10px] text-stone-600 hover:text-stone-900"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-[10px] text-stone-400"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-stone-600 mt-0.5">{c.body}</p>
                )}

                {/* Actions */}
                {editingId !== c.id && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {user?.id === c.author_id && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(c.id);
                            setEditBody(c.body);
                          }}
                          className="text-[10px] text-stone-400 hover:text-stone-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-[10px] text-stone-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handlePin(c.id, c.is_pinned)}
                        className="text-[10px] text-stone-400 hover:text-amber-600"
                      >
                        {c.is_pinned ? "Unpin" : "Pin"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post form */}
      {user && (
        <form onSubmit={handlePost} className="flex gap-1.5">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 text-xs border border-stone-200 rounded-md px-2 py-1.5 focus:border-stone-400 focus:ring-0"
          />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="text-xs px-2.5 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-40"
          >
            Post
          </button>
        </form>
      )}

      {comments.length === 0 && !user && (
        <p className="text-xs text-stone-400">No comments yet</p>
      )}
    </div>
  );
}
