"use client";

import type { SongResource, SongResourceType } from "@/lib/types";
import { useMedia } from "@/lib/media-context";
import { TAG_COLORS } from "@/lib/resource-tags";

// --- Utility ---

export function resourceUrl(resource: SongResource): string | null {
  if (resource.url) return resource.url;
  if (resource.storagePath) {
    const supabaseUrl = typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : undefined;
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/song-resources/${resource.storagePath}`;
    }
  }
  if (resource.filePath) {
    return `/api/music/${encodeURIComponent(resource.filePath)}`;
  }
  return null;
}

// --- Sub-components ---

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

function TagBadges({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className="inline-flex gap-0.5 ml-1">
      {tags.map((tag) => {
        const colors = TAG_COLORS[tag] || { bg: "bg-stone-100", text: "text-stone-600" };
        return (
          <span
            key={tag}
            className={`px-1 py-0.5 text-[9px] font-bold rounded ${colors.bg} ${colors.text}`}
          >
            {tag}
          </span>
        );
      })}
    </span>
  );
}

function DownloadButton({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      download
      onClick={(e) => e.stopPropagation()}
      className="p-1 text-stone-300 hover:text-stone-600 transition-colors shrink-0"
      title={`Download ${label}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </a>
  );
}

function PreviewButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`p-1 transition-colors shrink-0 ${isOpen ? "text-blue-500" : "text-stone-300 hover:text-stone-600"}`}
      title={isOpen ? "Close preview" : "Preview"}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

// --- Main Component ---

interface ResourceLinkProps {
  resource: SongResource;
  songTitle?: string;
  isAdmin?: boolean;
  onDelete?: () => void;
  onEdit?: (id: string, tags: string[], visibility: "all" | "admin") => void;
  songId?: string;
  recordedKey?: string;
  chartKeys?: string[];
  previewId?: string | null;
  onPreviewToggle?: (id: string | null) => void;
}

export default function ResourceLink({
  resource,
  songTitle,
  isAdmin,
  onDelete,
  onEdit,
  songId,
  recordedKey,
  chartKeys,
  previewId,
  onPreviewToggle,
}: ResourceLinkProps) {
  const { play } = useMedia();
  const url = resourceUrl(resource);
  const isAudio = resource.type === "audio";
  const isPlayableAudio = isAudio && (resource.url || resource.storagePath || resource.filePath);
  const isYouTube = resource.type === "youtube" && resource.url;

  // Determine if this resource can be previewed inline
  const isPreviewable = (() => {
    if (!url) return false;
    const lower = (resource.filePath || resource.storagePath || url).toLowerCase();
    return lower.endsWith(".pdf") || lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg");
  })();

  const isPdf = (() => {
    const lower = (resource.filePath || resource.storagePath || url || "").toLowerCase();
    return lower.endsWith(".pdf");
  })();

  const isPreviewOpen = previewId === resource.id;
  const togglePreview = () => {
    onPreviewToggle?.(isPreviewOpen ? null : resource.id);
  };

  const openInPlayer = (type: "audio" | "youtube", mediaUrl: string) => {
    play({
      type,
      url: mediaUrl,
      title: songTitle || resource.label,
      subtitle: resource.label,
      songId,
      recordedKey,
      chartKeys,
    });
  };

  // UUID format = Supabase resource (editable)
  const isSupabaseResource = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resource.id);

  const editButton = isAdmin && onEdit && isSupabaseResource ? (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onEdit(resource.id, resource.tags || [], resource.visibility || "all");
      }}
      className="p-0.5 text-stone-300 hover:text-stone-600 transition-colors shrink-0"
      title="Edit tags"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  ) : null;

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

  // Visibility badge for admin-only resources
  const visibilityBadge = resource.visibility === "admin" ? (
    <span className="px-1 py-0.5 text-[9px] font-bold bg-stone-200 text-stone-500 rounded ml-1">
      ADMIN
    </span>
  ) : null;

  if (isPlayableAudio && url) {
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
            <TagBadges tags={resource.tags} />
            {visibilityBadge}
          </p>
        </div>
        {url && <DownloadButton url={url} label={resource.label} />}
        {editButton}
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
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 min-w-0 flex-1"
        >
          <TypeIcon type={resource.type} />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-medium text-stone-700 truncate">
              {resource.label}
              <TagBadges tags={resource.tags} />
              {visibilityBadge}
            </p>
            <p className="text-[10px] text-stone-400 truncate">Opens on YouTube</p>
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
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
        {editButton}
        {deleteButton}
      </div>
    );
  }

  if (url) {
    const isExternal = resource.url?.startsWith("http");
    return (
      <>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md border hover:border-stone-300 transition-colors group ${
            isPreviewOpen
              ? "border-blue-300 bg-blue-50"
              : resource.isHighlighted
                ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
                : "border-stone-200 bg-white hover:bg-stone-50"
          } ${isPreviewable ? "cursor-pointer" : ""}`}
          onClick={isPreviewable ? togglePreview : undefined}
        >
          <TypeIcon type={resource.type} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-stone-700 truncate">
              {resource.label}
              <TagBadges tags={resource.tags} />
              {visibilityBadge}
            </p>
            {resource.url && !isPreviewOpen && (
              <p className="text-[10px] text-stone-400 truncate">{resource.url}</p>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {isPreviewable && <PreviewButton isOpen={isPreviewOpen} onClick={togglePreview} />}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-stone-300 hover:text-stone-600 transition-colors shrink-0"
              title="Open in new tab"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            {!isExternal && <DownloadButton url={url} label={resource.label} />}
            {editButton}
            {deleteButton}
          </div>
        </div>
        {isPreviewOpen && isPreviewable && (
          <div className="mt-1.5 rounded-md border border-blue-200 overflow-hidden bg-white">
            {isPdf ? (
              <iframe
                src={`${url}#navpanes=0&view=FitH`}
                className="w-full border-0"
                style={{ height: "50vh", minHeight: 300 }}
                title={`Preview: ${resource.label}`}
              />
            ) : (
              <img
                src={url}
                alt={resource.label}
                className="w-full h-auto"
              />
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-stone-200 bg-white">
      <TypeIcon type={resource.type} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-stone-700">
          {resource.label}
          <TagBadges tags={resource.tags} />
          {visibilityBadge}
        </p>
        {resource.value && (
          <p className="text-[10px] text-stone-500">{resource.value}</p>
        )}
      </div>
      {editButton}
      {deleteButton}
    </div>
  );
}
