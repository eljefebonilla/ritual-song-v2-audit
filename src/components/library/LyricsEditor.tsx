"use client";

import { useState, useEffect } from "react";

interface LyricsEditorProps {
  songId: string;
  songTitle: string;
}

interface SongMetadata {
  song_id: string;
  lyrics_text: string | null;
  has_alleluia: boolean;
  lyrics_source: string | null;
}

export default function LyricsEditor({ songId, songTitle }: LyricsEditorProps) {
  const [metadata, setMetadata] = useState<SongMetadata | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [hasAlleluia, setHasAlleluia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/songs/${songId}/metadata`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setMetadata(data);
          setLyrics(data.lyrics_text || "");
          setHasAlleluia(data.has_alleluia || false);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [songId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/songs/${songId}/metadata`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics_text: lyrics.trim() || null,
          has_alleluia: hasAlleluia,
          lyrics_source: "manual",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMetadata(data);
        setHasAlleluia(data.has_alleluia);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  // Auto-detect alleluia as user types
  const lyricsLower = lyrics.toLowerCase();
  const detectedAlleluia =
    lyricsLower.includes("alleluia") || lyricsLower.includes("hallelujah");

  return (
    <div className="border-t border-stone-100 pt-3 mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-stone-400 hover:text-stone-600 transition-colors w-full"
      >
        <svg
          width="10" height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Lyrics & Metadata
        {metadata?.has_alleluia && (
          <span className="px-1 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded normal-case tracking-normal">
            Alleluia
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Paste lyrics here..."
            rows={6}
            className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5 resize-y font-mono text-stone-700 placeholder:text-stone-300"
          />

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={hasAlleluia || detectedAlleluia}
                onChange={(e) => setHasAlleluia(e.target.checked)}
                disabled={detectedAlleluia}
                className="rounded border-stone-300"
              />
              Contains Alleluia
            </label>
            {detectedAlleluia && (
              <span className="text-[10px] text-amber-600">(detected in lyrics)</span>
            )}
          </div>

          {metadata?.lyrics_source && (
            <p className="text-[10px] text-stone-400">
              Source: {metadata.lyrics_source}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Lyrics"}
            </button>
            {saved && (
              <span className="text-xs text-green-600">Saved</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
