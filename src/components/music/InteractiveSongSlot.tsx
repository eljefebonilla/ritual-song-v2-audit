"use client";

import { useState, useRef } from "react";
import type { RefObject } from "react";
import type { SongEntry, ResolvedSong } from "@/lib/types";
import { useMedia } from "@/lib/media-context";

interface InteractiveSongSlotProps {
  label: string;
  song: SongEntry;
  resolved: ResolvedSong;
  isSelected?: boolean;
  onSelect?: () => void;
  rowRef?: RefObject<HTMLDivElement | null>;
}

const RESOURCE_TYPES = [
  { value: "audio", label: "Audio File" },
  { value: "sheet_music", label: "Sheet Music" },
  { value: "practice_track", label: "Practice Track" },
  { value: "lyrics", label: "Lyrics" },
  { value: "other", label: "Other" },
] as const;

function getLastName(composer: string | undefined): string {
  if (!composer) return "";
  // Handle "J. Doe / M. Smith" → "Doe"
  const first = composer.split(/[\/&,]/).map((s) => s.trim())[0];
  const parts = first.split(/\s+/);
  return parts[parts.length - 1];
}

export default function InteractiveSongSlot({
  label,
  song,
  resolved,
  isSelected,
  onSelect,
  rowRef,
}: InteractiveSongSlotProps) {
  const { play, stop, current } = useMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local audio override after upload
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);

  // Drag & drop state
  const [dragOver, setDragOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const effectiveAudioUrl = localAudioUrl || resolved.audioUrl;
  const effectiveAudioType = localAudioUrl ? "audio" as const : resolved.audioType;
  const isPlaying = current?.url === effectiveAudioUrl;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!effectiveAudioUrl || !effectiveAudioType) return;
    if (isPlaying) {
      stop();
    } else {
      play({
        type: effectiveAudioType,
        url: effectiveAudioUrl,
        title: resolved.title,
        subtitle: label,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setDroppedFile(file);
    }
  };

  const handleUpload = async (type: string) => {
    if (!droppedFile || uploading) return;
    setUploading(true);

    // Auto-name for audio
    const lastName = getLastName(song.composer);
    const autoLabel =
      type === "audio" || type === "practice_track"
        ? `${song.title}${lastName ? ` (${lastName})` : ""}`
        : droppedFile.name;

    try {
      const formData = new FormData();
      formData.append("file", droppedFile);
      formData.append("label", autoLabel);
      formData.append("type", type);

      const res = await fetch(`/api/songs/${resolved.id}/resources/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // If audio type, set local URL so play button appears immediately
        if (type === "audio" || type === "practice_track") {
          setLocalAudioUrl(data.resource.url);
        }
      }
    } finally {
      setUploading(false);
      setDroppedFile(null);
    }
  };

  const accentColor = "#4CAF50";

  return (
    <div
      ref={rowRef}
      className={`flex items-start gap-3 py-2 px-3 transition-all relative ${
        onSelect ? "cursor-pointer hover:bg-stone-50" : ""
      }`}
      style={isSelected ? {
        background: `linear-gradient(90deg, ${accentColor}08, ${accentColor}03)`,
        boxShadow: `inset 0 0 0 2px ${accentColor}40`,
        borderRadius: "4px",
      } : dragOver ? {
        background: `linear-gradient(90deg, ${accentColor}10, ${accentColor}05)`,
        boxShadow: `inset 0 0 0 2px ${accentColor}60`,
        borderRadius: "4px",
      } : undefined}
      onClick={onSelect}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {label}
      </span>
      {/* Play button column */}
      <span className="w-7 shrink-0 flex items-start justify-center pt-0.5">
        {effectiveAudioUrl && effectiveAudioType && (
          <button
            onClick={handleToggle}
            className="w-6 h-6 flex items-center justify-center rounded-full transition-all active:scale-95"
            title={isPlaying ? "Stop" : "Play"}
            style={isPlaying ? {
              background: `linear-gradient(145deg, ${accentColor}20, ${accentColor}10)`,
              border: `2px solid ${accentColor}`,
              boxShadow: `0 0 8px ${accentColor}30, 0 1px 4px ${accentColor}20`,
            } : {
              background: `linear-gradient(145deg, ${accentColor}0a, transparent)`,
              border: `2px solid ${accentColor}`,
              boxShadow: `0 1px 4px ${accentColor}15`,
            }}
          >
            {isPlaying ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="3">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinejoin="round">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            )}
          </button>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-800 leading-snug">
          {song.title}
        </p>
        {song.composer && (
          <p className="text-xs text-stone-500">{song.composer}</p>
        )}
        {song.description && song.description !== "Description" && (
          <p className="text-xs text-stone-400 italic">{song.description}</p>
        )}
      </div>

      {/* Drop zone indicator */}
      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ color: accentColor, backgroundColor: `${accentColor}15` }}
          >
            Drop to add resource
          </span>
        </div>
      )}

      {/* Resource type picker after drop */}
      {droppedFile && (
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white border border-stone-200 rounded-lg shadow-lg p-2 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 px-1">
            Resource type
          </p>
          <p className="text-[10px] text-stone-400 px-1 mb-2 truncate">
            {droppedFile.name}
          </p>
          {uploading ? (
            <p className="text-xs text-stone-500 px-1 py-2">Uploading...</p>
          ) : (
            <div className="space-y-0.5">
              {RESOURCE_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => handleUpload(rt.value)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-stone-50 text-stone-700 transition-colors"
                >
                  {rt.label}
                </button>
              ))}
              <button
                onClick={() => setDroppedFile(null)}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-stone-50 text-stone-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input (not used currently, but available) */}
      <input ref={fileInputRef} type="file" className="hidden" />
    </div>
  );
}
