"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  LibrarySong,
  SongResource,
  SongResourceType,
  SongResourceSource,
} from "@/lib/types";
import { useUser } from "@/lib/user-context";
import { useMedia } from "@/lib/media-context";
import Link from "next/link";

interface SongDetailPanelProps {
  song: LibrarySong;
  onClose: () => void;
  onAudioUploaded?: (songId: string, url: string) => void;
}

const RESOURCE_TYPE_LABELS: Record<SongResourceType, string> = {
  audio: "Audio",
  sheet_music: "Sheet Music",
  practice_track: "Practice Track",
  hymnal_ref: "Hymnal Reference",
  notation: "Notation",
  lyrics: "Lyrics",
  ocp_link: "OCP",
  youtube: "YouTube",
  other: "Other",
};

const SOURCE_LABELS: Record<SongResourceSource, string> = {
  local: "Local Files",
  supabase: "Uploaded Files",
  ocp_bb: "Breaking Bread (OCP)",
  ocp_ss: "Spirit & Song (OCP)",
  youtube: "YouTube",
  manual: "Manual Links",
};

const UPLOAD_ACCEPT = ".pdf,.mp3,.wav,.m4a,.aif,.aiff,.png,.jpg,.jpeg,.musx,.mxl,.txt";

function resourceUrl(resource: SongResource): string | null {
  if (resource.url) return resource.url;
  if (resource.filePath) {
    return `/api/music/${encodeURIComponent(resource.filePath)}`;
  }
  return null;
}

function ResourceLink({
  resource,
  songTitle,
  isAdmin,
  onDelete,
}: {
  resource: SongResource;
  songTitle?: string;
  isAdmin?: boolean;
  onDelete?: () => void;
}) {
  const { play } = useMedia();
  const url = resourceUrl(resource);
  const isAudio = resource.type === "audio";
  const isLocalAudio = isAudio && resource.filePath;
  const isYouTube = resource.type === "youtube" && resource.url;

  const openInPlayer = (type: "audio" | "youtube", mediaUrl: string) => {
    play({
      type,
      url: mediaUrl,
      title: songTitle || resource.label,
      subtitle: resource.label,
    });
  };

  const deleteButton = isAdmin && onDelete ? (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete();
      }}
      className="p-0.5 text-stone-300 hover:text-red-500 transition-colors shrink-0"
      title="Delete resource"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  ) : null;

  if (isLocalAudio && url) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
          resource.isHighlighted
            ? "border-amber-300 bg-amber-50"
            : "border-stone-200 bg-white"
        }`}
      >
        <button
          onClick={() => openInPlayer("audio", url)}
          className="w-6 h-6 flex items-center justify-center rounded-full shrink-0 transition-all active:scale-95"
          style={{
            background: "linear-gradient(145deg, #4CAF500a, transparent)",
            border: "2px solid #4CAF50",
            boxShadow: "0 1px 4px #4CAF5015",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinejoin="round">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-700 truncate">
            {resource.label}
            {resource.isHighlighted && (
              <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-800 rounded">
                AIM
              </span>
            )}
          </p>
        </div>
        {deleteButton}
      </div>
    );
  }

  if (isYouTube && resource.url) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md border hover:border-stone-300 transition-colors group ${
          resource.isHighlighted
            ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
            : "border-stone-200 bg-white hover:bg-stone-50"
        }`}
      >
        <button
          type="button"
          onClick={() => openInPlayer("youtube", resource.url!)}
          className="flex items-center gap-2 min-w-0 flex-1"
        >
          <TypeIcon type={resource.type} />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-medium text-stone-700 truncate">
              {resource.label}
              {resource.isHighlighted && (
                <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-800 rounded">
                  AIM
                </span>
              )}
            </p>
            <p className="text-[10px] text-stone-400 truncate">
              Open in player
            </p>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-stone-300 group-hover:text-stone-500 shrink-0">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </button>
        {deleteButton}
      </div>
    );
  }

  if (url) {
    const isExternal = resource.url?.startsWith("http");
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md border hover:border-stone-300 transition-colors group ${
          resource.isHighlighted
            ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
            : "border-stone-200 bg-white hover:bg-stone-50"
        }`}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 min-w-0 flex-1"
        >
          <TypeIcon type={resource.type} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-stone-700 truncate">
              {resource.label}
              {resource.isHighlighted && (
                <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-800 rounded">
                  AIM
                </span>
              )}
            </p>
            {resource.url && (
              <p className="text-[10px] text-stone-400 truncate">
                {resource.url}
              </p>
            )}
          </div>
          <svg
            className="w-3 h-3 text-stone-300 group-hover:text-stone-500 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isExternal ? (
              <>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </>
            ) : (
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            )}
          </svg>
        </a>
        {deleteButton}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-stone-200 bg-white">
      <TypeIcon type={resource.type} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-stone-700">{resource.label}</p>
        {resource.value && (
          <p className="text-[10px] text-stone-500">{resource.value}</p>
        )}
      </div>
      {deleteButton}
    </div>
  );
}

function TypeIcon({ type }: { type: SongResourceType }) {
  const cls = "w-4 h-4 text-stone-400 shrink-0";
  switch (type) {
    case "audio":
    case "practice_track":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      );
    case "sheet_music":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "notation":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M8 13h2M8 17h6" />
        </svg>
      );
    case "ocp_link":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    case "youtube":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
  }
}

function getLastName(composer: string | undefined): string {
  if (!composer) return "";
  const first = composer.split(/[\/&,]/).map((s) => s.trim())[0];
  const parts = first.split(/\s+/);
  return parts[parts.length - 1];
}

export default function SongDetailPanel({
  song,
  onClose,
  onAudioUploaded,
}: SongDetailPanelProps) {
  const router = useRouter();
  const { role } = useUser();
  const isAdmin = role === "admin";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Add resource state
  const [addingResource, setAddingResource] = useState(false);
  const [addMode, setAddMode] = useState<"link" | "upload">("link");
  const [newType, setNewType] = useState<SongResourceType>("youtube");
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const uploadingRef = useRef(false);
  const [localResources, setLocalResources] = useState<SongResource[]>([]);

  // Edit song state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(song.title);
  const [editComposer, setEditComposer] = useState(song.composer || "");
  const [editSaving, setEditSaving] = useState(false);

  // Delete song state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Supabase resources state
  const [supabaseResources, setSupabaseResources] = useState<SongResource[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/songs/${song.id}/resources/supabase`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.resources) {
          setSupabaseResources(data.resources);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [song.id]);

  // Delete resource state
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);
  const [removedResourceIds, setRemovedResourceIds] = useState<Set<string>>(new Set());

  // Combine static JSON + Supabase + locally-added, dedup by ID, minus removed
  const allResources = (() => {
    const seen = new Set<string>();
    const result: SongResource[] = [];
    for (const r of [...song.resources, ...supabaseResources, ...localResources]) {
      if (!seen.has(r.id) && !removedResourceIds.has(r.id)) {
        seen.add(r.id);
        result.push(r);
      }
    }
    return result;
  })();

  // Group resources by source
  const resourcesBySource = allResources.reduce<
    Record<string, SongResource[]>
  >((acc, r) => {
    const source = r.source || "manual";
    (acc[source] = acc[source] || []).push(r);
    return acc;
  }, {});

  // Sort: highlighted (AIM) first within each group
  for (const resources of Object.values(resourcesBySource)) {
    resources.sort((a, b) => {
      if (a.isHighlighted && !b.isHighlighted) return -1;
      if (!a.isHighlighted && b.isHighlighted) return 1;
      return 0;
    });
  }

  const sourceOrder: SongResourceSource[] = [
    "local",
    "supabase",
    "ocp_bb",
    "ocp_ss",
    "youtube",
    "manual",
  ];

  // --- Handlers ---

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/songs/${song.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          composer: editComposer.trim() || undefined,
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSong = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/songs/${song.id}`, { method: "DELETE" });
      if (res.ok) {
        onClose();
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    try {
      const res = await fetch(
        `/api/songs/${song.id}/resources/${resourceId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setRemovedResourceIds((prev) => new Set(prev).add(resourceId));
        setDeletingResourceId(null);
      }
    } catch {
      setDeletingResourceId(null);
    }
  };

  const handleAddLink = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/songs/${song.id}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          label: newLabel.trim(),
          url: newUrl.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalResources((prev) => [...prev, data.resource]);
        setAddingResource(false);
        setNewLabel("");
        setNewUrl("");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelected = (file: File) => {
    setUploadFile(file);
    const ext = file.name.split(".").pop()?.toLowerCase();
    let detectedType: SongResourceType = "other";
    let suffix = "";

    if (ext === "pdf" || ext === "png" || ext === "jpg" || ext === "jpeg") {
      detectedType = "sheet_music";
    } else if (["mp3", "wav", "m4a", "aif", "aiff"].includes(ext || "")) {
      detectedType = "audio";
    } else if (["musx", "mxl", "musicxml"].includes(ext || "")) {
      detectedType = "notation";
      suffix = " - Notation";
    } else if (ext === "txt") {
      detectedType = "lyrics";
      suffix = " - Lyrics";
    }

    setNewType(detectedType);

    // Auto-fill label: "Title (LastName)" + optional suffix
    const lastName = getLastName(song.composer);
    const base = `${song.title}${lastName ? ` (${lastName})` : ""}`;
    setNewLabel(`${base}${suffix}`);
  };

  const handleUploadFile = async () => {
    if (!uploadFile || !newLabel.trim() || uploadingRef.current) return;
    uploadingRef.current = true;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("label", newLabel.trim());
      if (newType !== "youtube" && newType !== "ocp_link") {
        formData.append("type", newType);
      }
      const res = await fetch(`/api/songs/${song.id}/resources/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        // Only add if not already present (dedup)
        setLocalResources((prev) => {
          if (prev.some((r) => r.id === data.resource.id)) return prev;
          return [...prev, data.resource];
        });
        // Signal audio upload so play button appears in Order of Worship
        if (
          (newType === "audio" || newType === "practice_track") &&
          data.resource.url &&
          onAudioUploaded
        ) {
          onAudioUploaded(song.id, data.resource.url);
        }
        setAddingResource(false);
        setNewLabel("");
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } finally {
      setSaving(false);
      uploadingRef.current = false;
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      <div className="
        fixed inset-0 z-50 bg-white flex flex-col
        md:relative md:inset-auto md:z-auto md:w-80 md:border-l md:border-stone-200 md:shrink-0
      ">
        {/* Header */}
        <div className="p-4 border-b border-stone-200">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-sm font-bold text-stone-900 border border-stone-300 rounded px-1.5 py-0.5"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editComposer}
                    onChange={(e) => setEditComposer(e.target.value)}
                    placeholder="Composer"
                    className="w-full text-xs text-stone-500 border border-stone-300 rounded px-1.5 py-0.5"
                  />
                  <div className="flex gap-1.5">
                    <button
                      disabled={editSaving || !editTitle.trim()}
                      onClick={handleSaveEdit}
                      className="px-2 py-0.5 text-[10px] font-medium bg-stone-900 text-white rounded hover:bg-stone-800 disabled:opacity-50"
                    >
                      {editSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditTitle(song.title);
                        setEditComposer(song.composer || "");
                      }}
                      className="px-2 py-0.5 text-[10px] font-medium text-stone-500 rounded hover:bg-stone-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <h2 className="text-sm font-bold text-stone-900 leading-tight">
                      {song.title}
                    </h2>
                    {isAdmin && (
                      <button
                        onClick={() => setEditing(true)}
                        className="p-0.5 text-stone-300 hover:text-stone-600 transition-colors"
                        title="Edit song"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {song.composer && (
                    <p className="text-xs text-stone-500 mt-0.5">{song.composer}</p>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isAdmin && !editing && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1 text-stone-300 hover:text-red-500 transition-colors"
                  title="Delete song"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-800 font-medium">
                Delete &ldquo;{song.title}&rdquo;? This cannot be undone.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  disabled={deleting}
                  onClick={handleDeleteSong}
                  className="px-2.5 py-1 text-[10px] font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-[10px] font-medium text-stone-500 rounded hover:bg-stone-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <p className="text-[10px] text-stone-400">
              Used {song.usageCount}x
            </p>
            {allResources.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                {allResources.length} resource
                {allResources.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Resources */}
        <div className="flex-1 overflow-y-auto p-4">
          {allResources.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-stone-400">No resources linked yet.</p>
              {isAdmin && (
                <p className="text-xs text-stone-300 mt-1">
                  Click below to add audio, sheet music, or other resources.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {sourceOrder.map((source) => {
                const resources = resourcesBySource[source];
                if (!resources || resources.length === 0) return null;
                return (
                  <div key={source}>
                    <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1.5">
                      {SOURCE_LABELS[source] || source}
                    </h3>
                    <div className="space-y-1.5">
                      {resources.map((r) => (
                        <div key={r.id} className="relative">
                          {/* Resource delete confirmation overlay */}
                          {deletingResourceId === r.id && (
                            <div className="absolute inset-0 z-10 bg-white/95 border border-red-200 rounded-md flex items-center justify-center gap-2 px-2">
                              <p className="text-[10px] text-red-700 font-medium">Delete?</p>
                              <button
                                onClick={() => handleDeleteResource(r.id)}
                                className="px-1.5 py-0.5 text-[10px] font-medium bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeletingResourceId(null)}
                                className="px-1.5 py-0.5 text-[10px] font-medium text-stone-500 rounded hover:bg-stone-100"
                              >
                                No
                              </button>
                            </div>
                          )}
                          <ResourceLink
                            resource={r}
                            songTitle={song.title}
                            isAdmin={isAdmin}
                            onDelete={() => setDeletingResourceId(r.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add resource form (admin only) */}
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              {addingResource ? (
                <div className="space-y-2">
                  {/* Mode toggle */}
                  <div className="flex rounded-md border border-stone-200 overflow-hidden">
                    <button
                      onClick={() => setAddMode("link")}
                      className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                        addMode === "link"
                          ? "bg-stone-900 text-white"
                          : "bg-white text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      Add Link
                    </button>
                    <button
                      onClick={() => setAddMode("upload")}
                      className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                        addMode === "upload"
                          ? "bg-stone-900 text-white"
                          : "bg-white text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      Upload File
                    </button>
                  </div>

                  {addMode === "link" ? (
                    /* Link mode — existing form */
                    <>
                      <select
                        value={newType}
                        onChange={(e) =>
                          setNewType(e.target.value as SongResourceType)
                        }
                        className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
                      >
                        {Object.entries(RESOURCE_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Label (e.g., YouTube Recording)"
                        className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
                      />
                      <input
                        type="text"
                        value={newUrl}
                        onChange={(e) => {
                          const url = e.target.value;
                          setNewUrl(url);
                          if (
                            (url.includes("youtube.com") ||
                              url.includes("youtu.be")) &&
                            newType !== "youtube"
                          ) {
                            setNewType("youtube");
                            if (!newLabel) setNewLabel("YouTube");
                          }
                        }}
                        placeholder="URL (YouTube, Dropbox, etc.)"
                        className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={saving || !newLabel.trim()}
                          onClick={handleAddLink}
                          className="flex-1 px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Add Link"}
                        </button>
                        <button
                          onClick={() => setAddingResource(false)}
                          className="px-3 py-1.5 text-xs font-medium text-stone-500 rounded-md hover:bg-stone-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Upload mode */
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={UPLOAD_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelected(file);
                        }}
                        className="hidden"
                      />
                      {uploadFile ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border border-stone-200 rounded-md">
                          <svg className="w-4 h-4 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span className="text-xs text-stone-700 truncate flex-1">{uploadFile.name}</span>
                          <button
                            onClick={() => {
                              setUploadFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="text-stone-400 hover:text-stone-600"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleFileSelected(file);
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          className={`flex flex-col items-center justify-center gap-1 px-3 py-4 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                            dragOver
                              ? "border-stone-900 bg-stone-50"
                              : "border-stone-300 hover:border-stone-400"
                          }`}
                        >
                          <svg className="w-5 h-5 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <p className="text-xs text-stone-500">Drop file here or click to browse</p>
                          <p className="text-[10px] text-stone-400">PDF, audio, images, notation</p>
                        </div>
                      )}
                      {/* Type selector */}
                      {uploadFile && (
                        <select
                          value={newType}
                          onChange={(e) => setNewType(e.target.value as SongResourceType)}
                          className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
                        >
                          {Object.entries(RESOURCE_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      )}
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Label (e.g., Lead Sheet, LS AIM)"
                        className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={saving || !uploadFile || !newLabel.trim()}
                          onClick={handleUploadFile}
                          className="flex-1 px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors disabled:opacity-50"
                        >
                          {saving ? "Uploading..." : "Upload"}
                        </button>
                        <button
                          onClick={() => {
                            setAddingResource(false);
                            setUploadFile(null);
                            setDragOver(false);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-stone-500 rounded-md hover:bg-stone-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAddingResource(true)}
                  className="w-full px-3 py-2 text-xs font-medium text-stone-500 border border-dashed border-stone-300 rounded-md hover:border-stone-400 hover:text-stone-700 transition-colors"
                >
                  + Add Resource
                </button>
              )}
            </div>
          )}
        </div>

        {/* Occasions list */}
        {song.occasions.length > 0 && (
          <div className="border-t border-stone-200 p-4">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
              Used In
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {song.occasions.slice(0, 10).map((occId) => (
                <Link
                  key={occId}
                  href={`/occasion/${occId}`}
                  className="block text-xs text-stone-500 hover:text-stone-800 truncate transition-colors"
                >
                  {occId
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </Link>
              ))}
              {song.occasions.length > 10 && (
                <p className="text-[10px] text-stone-300">
                  + {song.occasions.length - 10} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
