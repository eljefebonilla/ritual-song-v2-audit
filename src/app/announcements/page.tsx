"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/lib/user-context";

interface Author {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author: Author | null;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  community: string | null;
  created_at: string;
  updated_at: string;
  author: Author | null;
  comments: Comment[];
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

function AnnouncementCard({
  announcement,
  isAdmin,
  onDelete,
  onTogglePin,
  onRefresh,
}: {
  announcement: Announcement;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onRefresh: () => void;
}) {
  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting] = useState(false);
  const { user } = useUser();

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/announcements/${announcement.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody.trim() }),
    });
    if (res.ok) {
      setCommentBody("");
      onRefresh();
    }
    setPosting(false);
  };

  return (
    <div className={`border rounded-lg bg-white ${
      announcement.pinned ? "border-amber-300 ring-1 ring-amber-100" : "border-stone-200"
    }`}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {announcement.pinned && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  PINNED
                </span>
              )}
              <h3 className="text-sm font-bold text-stone-900">{announcement.title}</h3>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-stone-500">
                {announcement.author?.full_name || "Admin"}
              </span>
              <span className="text-xs text-stone-400">
                {timeAgo(announcement.created_at)}
              </span>
              {announcement.community && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">
                  {announcement.community}
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onTogglePin(announcement.id, announcement.pinned)}
                className="text-xs text-stone-400 hover:text-amber-600 px-1.5 py-0.5"
                title={announcement.pinned ? "Unpin" : "Pin"}
              >
                {announcement.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                onClick={() => onDelete(announcement.id)}
                className="text-xs text-stone-400 hover:text-red-500 px-1.5 py-0.5"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-stone-700 mt-2 whitespace-pre-wrap">{announcement.body}</p>
      </div>

      {/* Comments */}
      {(announcement.comments.length > 0 || user) && (
        <div className="border-t border-stone-100 px-4 py-3">
          {announcement.comments.length > 0 && (
            <div className="space-y-2 mb-3">
              {announcement.comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-stone-200 flex items-center justify-center text-[9px] text-stone-500 font-medium shrink-0 mt-0.5">
                    {c.author?.full_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-stone-700">
                        {c.author?.full_name || "Unknown"}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {timeAgo(c.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {user && (
            <form onSubmit={handleComment} className="flex gap-1.5">
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 text-xs border border-stone-200 rounded-md px-2 py-1.5 focus:border-stone-400 focus:ring-0"
              />
              <button
                type="submit"
                disabled={posting || !commentBody.trim()}
                className="text-xs px-2.5 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-40"
              >
                Post
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnnouncementsPage() {
  const { isAdmin } = useUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // New announcement form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [community, setCommunity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    const res = await fetch("/api/announcements");
    if (res.ok) {
      const data = await res.json();
      setAnnouncements(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        community: community || null,
      }),
    });
    if (res.ok) {
      setTitle("");
      setContent("");
      setCommunity("");
      setShowForm(false);
      fetchAnnouncements();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    fetchAnnouncements();
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    await fetch(`/api/announcements/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !pinned }),
    });
    fetchAnnouncements();
  };

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Announcements</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Weekly announcements and updates for the music ministry.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && isAdmin && (
        <form onSubmit={handleCreate} className="mb-6 border border-stone-200 rounded-lg bg-white p-4 space-y-3">
          <input
            type="text"
            placeholder="Announcement title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm font-medium border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
            autoFocus
          />
          <textarea
            placeholder="Write your announcement..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none"
          />
          <div className="flex items-center gap-3">
            <select
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              className="text-xs border border-stone-200 rounded-md px-2 py-1.5 bg-white"
            >
              <option value="">All Communities</option>
              <option value="Reflections">Reflections</option>
              <option value="Foundations">Foundations</option>
              <option value="Generations">Generations</option>
              <option value="Heritage">Heritage</option>
              <option value="Elevations">Elevations</option>
            </select>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !content.trim()}
              className="text-xs px-4 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-sm text-stone-400">
          Loading announcements...
        </div>
      ) : announcements.length === 0 ? (
        <div className="border border-dashed border-stone-300 rounded-lg p-8 text-center">
          <p className="text-stone-400 text-sm">
            No announcements yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              onRefresh={fetchAnnouncements}
            />
          ))}
        </div>
      )}
    </div>
  );
}
