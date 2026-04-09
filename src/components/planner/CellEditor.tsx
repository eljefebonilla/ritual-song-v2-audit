"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GridRowKey } from "@/lib/grid-types";
import type { GridCellData } from "@/lib/grid-types";

interface SongResult {
  id: string;
  title: string;
  composer: string | null;
  category: string | null;
  usageCount: number;
}

interface ScoredRec {
  songId: string;
  title: string;
  composer?: string;
  score: number;
  reasons: { type: string; detail: string; points: number }[];
  weeksSinceUsed: number | null;
  weeksUntilNext: number | null;
}

interface LyricsVerse {
  label: string;
  text: string;
}

interface ExplainResult {
  song: { title: string; composer?: string };
  totalScore: number;
  breakdown: { category: string; detail: string; explanation?: string; points: number }[];
  weeksSinceUsed: number | null;
  weeksUntilNext: number | null;
  lyrics?: LyricsVerse[] | null;
  matchedVerseLabel?: string | null;
  readingKeywords?: string[];
}

// Map grid row keys to recommendation position names
const ROW_TO_POSITION: Partial<Record<GridRowKey, string>> = {
  prelude: "prelude",
  gathering: "gathering",
  sprinklingRite: "sprinkling_rite",
  penitentialAct: "penitential_act",
  gloria: "gloria",
  psalm: "psalm",
  gospelAcclamation: "gospel_acclamation",
  offertory: "offertory",
  massSetting: "mass_setting",
  lordsPrayer: "lords_prayer",
  fractionRite: "fraction_rite",
  communion1: "communion",
  communion2: "communion",
  communion3: "communion",
  communion4: "communion",
  sending: "sending",
};

interface CellEditorProps {
  occasionId: string;
  ensembleId: string;
  rowKey: GridRowKey;
  currentData: GridCellData;
  anchorRect: DOMRect;
  onSave: (rowKey: GridRowKey, title: string, composer: string, description?: string, youtubeUrl?: string) => void;
  onClear: (rowKey: GridRowKey) => void;
  onClose: () => void;
  onBulkApply?: (rowKey: GridRowKey, title: string, composer: string, scope: "season" | "season-all" | "all", youtubeUrl?: string) => void;
}

export default function CellEditor({
  occasionId,
  rowKey,
  currentData,
  anchorRect,
  onSave,
  onClear,
  onClose,
  onBulkApply,
}: CellEditorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [title, setTitle] = useState(currentData.title || "");
  const [composer, setComposer] = useState(currentData.composer || "");
  const [description, setDescription] = useState(currentData.description || "");
  const [youtubeUrl, setYoutubeUrl] = useState(currentData.youtubeUrl || "");
  const [mode, setMode] = useState<"suggest" | "search" | "manual">("suggest");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Recommendation state
  const [recs, setRecs] = useState<ScoredRec[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [explainSong, setExplainSong] = useState<ExplainResult | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [showBulkApply, setShowBulkApply] = useState(false);
  const [pendingBulkSong, setPendingBulkSong] = useState<{ title: string; composer: string; youtubeUrl?: string; description?: string } | null>(null);

  const position = ROW_TO_POSITION[rowKey];
  const isBulkEligible = true; // All song rows support "This Sunday" / "All Sundays" scope
  const isCommunionRow = /^communion[1-4]$/.test(rowKey);

  // Auto-load suggestions when in suggest mode
  useEffect(() => {
    if (mode !== "suggest" || recs !== null || !position) return;
    setRecsLoading(true);
    fetch(`/api/recommendations/${occasionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position, limit: 8 }),
    })
      .then((r) => r.json())
      .then((data) => {
        setRecs(Array.isArray(data) ? data : data.recommendations || []);
      })
      .catch(() => setRecs([]))
      .finally(() => setRecsLoading(false));
  }, [mode, recs, position, occasionId]);

  // Fallback to search if no position mapping
  useEffect(() => {
    if (!position && mode === "suggest") setMode("search");
  }, [position, mode]);

  useEffect(() => {
    if (mode === "search") inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const searchSongs = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/songs?q=${encodeURIComponent(q)}&limit=10`);
      setResults(await res.json());
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchSongs(val), 200);
  };

  const handleSelectSong = (songTitle: string, songComposer: string, songYoutubeUrl?: string) => {
    setPendingBulkSong({ title: songTitle, composer: songComposer, youtubeUrl: songYoutubeUrl });
    setShowBulkApply(true);
  };

  const handleBulkConfirm = (scope: "this" | "season" | "season-all" | "all") => {
    if (!pendingBulkSong) return;
    const yt = pendingBulkSong.youtubeUrl;
    const desc = pendingBulkSong.description;
    if (scope === "this") {
      onSave(rowKey, pendingBulkSong.title, pendingBulkSong.composer, desc, yt);
    } else {
      onBulkApply?.(rowKey, pendingBulkSong.title, pendingBulkSong.composer, scope, yt);
    }
    onClose();
  };

  const handleExplain = async (rec: ScoredRec) => {
    if (explainSong?.song?.title === rec.title) {
      setExplainSong(null);
      return;
    }
    setExplainLoading(true);
    try {
      const res = await fetch(`/api/recommendations/${occasionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position, explain: rec.songId }),
      });
      const data = await res.json();
      const explanation = data.explanation || null;
      if (explanation) {
        explanation.lyrics = data.lyrics || null;
        explanation.matchedVerseLabel = data.matchedVerseLabel || null;
        explanation.readingKeywords = data.readingKeywords || [];
      }
      setExplainSong(explanation);
    } catch { setExplainSong(null); }
    finally { setExplainLoading(false); }
  };

  const handleManualSave = () => {
    if (!title.trim()) return;
    setPendingBulkSong({ title: title.trim(), composer: composer.trim(), youtubeUrl: youtubeUrl.trim() || undefined, description: description.trim() || undefined });
    setShowBulkApply(true);
  };

  const handleClear = () => {
    onClear(rowKey);
    onClose();
  };

  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 480);
  const left = Math.min(anchorRect.left, window.innerWidth - 340);

  // Reason type to label
  // Highlight reading keywords within verse text
  const highlightKeywords = (text: string, keywords: string[]) => {
    if (!keywords || keywords.length === 0) return text;
    const pattern = new RegExp(`\\b(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(pattern);
    return parts.map((part, i) =>
      pattern.test(part)
        ? <mark key={i} className="bg-parish-gold/20 text-stone-800 rounded-sm px-0.5">{part}</mark>
        : part
    );
  };

  const reasonLabel = (type: string, detail?: string) => {
    if (type === "scripture_match" && detail) {
      // Extract reading type from detail like "Gospel (Mt 24:37-44)" or "1st Reading"
      const label = detail.split("(")[0].trim();
      if (label) return label;
    }
    const map: Record<string, string> = {
      scripture_match: "Scripture",
      topic_match: "Topic",
      season_match: "Season",
      function_match: "Function",
      familiarity: "Familiar",
      user_ranking: "Ranked",
      recency_penalty: "Recent",
    };
    return map[type] || type;
  };

  const reasonColor = (type: string) => {
    const map: Record<string, string> = {
      scripture_match: "bg-blue-50 text-blue-600",
      topic_match: "bg-purple-50 text-purple-600",
      season_match: "bg-green-50 text-green-600",
      function_match: "bg-amber-50 text-amber-600",
      familiarity: "bg-stone-100 text-stone-500",
      recency_penalty: "bg-red-50 text-red-500",
    };
    return map[type] || "bg-stone-100 text-stone-500";
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        ref={panelRef}
        className="fixed z-50 w-[340px] bg-white border border-stone-200 rounded-lg shadow-xl max-h-[460px] flex flex-col"
        style={{ top, left }}
      >
        {/* Bulk apply dialog */}
        {showBulkApply && pendingBulkSong && (
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium text-stone-800">
              Apply &ldquo;{pendingBulkSong.title}&rdquo;
            </p>
            <p className="text-xs text-stone-500">
              Apply to just this Sunday, or make it the new default?
            </p>
            <div className="space-y-1.5">
              <button onClick={() => handleBulkConfirm("this")} className="w-full text-left px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-sm transition-colors">
                This Sunday only
              </button>
              <button onClick={() => handleBulkConfirm("season")} className="w-full text-left px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-sm transition-colors">
                All instances this season, this mass
              </button>
              <button onClick={() => handleBulkConfirm("season-all")} className="w-full text-left px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-sm transition-colors">
                All instances this season, every mass
              </button>
              <button onClick={() => handleBulkConfirm("all")} className="w-full text-left px-3 py-2 rounded-lg border border-parish-gold/30 bg-parish-gold/5 hover:bg-parish-gold/10 text-sm transition-colors">
                <span className="font-medium">All instances</span>
                <span className="text-xs text-stone-400 ml-1">(new default)</span>
              </button>
            </div>
            <button onClick={() => { setShowBulkApply(false); setPendingBulkSong(null); }} className="text-xs text-stone-400 hover:text-stone-600">
              Cancel
            </button>
          </div>
        )}

        {/* Normal editor */}
        {!showBulkApply && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-stone-100 shrink-0">
              {position && (
                <button
                  onClick={() => setMode("suggest")}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    mode === "suggest"
                      ? "text-parish-gold border-b-2 border-parish-gold"
                      : "text-stone-400 hover:text-stone-600"
                  }`}
                >
                  Suggestions
                </button>
              )}
              <button
                onClick={() => setMode("search")}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  mode === "search"
                    ? "text-stone-900 border-b-2 border-stone-900"
                    : "text-stone-400 hover:text-stone-600"
                }`}
              >
                Search
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  mode === "manual"
                    ? "text-stone-900 border-b-2 border-stone-900"
                    : "text-stone-400 hover:text-stone-600"
                }`}
              >
                Manual
              </button>
            </div>

            {/* N/A quick action for communion rows */}
            {isCommunionRow && (
              <div className="px-3 pt-2 pb-0 shrink-0">
                <button
                  onClick={() => handleSelectSong("N/A", "")}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-500 bg-stone-50 border border-stone-200 rounded-md hover:bg-stone-100 transition-colors"
                >
                  <span className="text-stone-400">Mark as</span>
                  <span className="px-1.5 py-0.5 bg-stone-200 text-stone-600 rounded text-[10px] font-semibold">N/A</span>
                </button>
              </div>
            )}

            <div className="p-3 overflow-y-auto flex-1">
              {/* ─── Suggestions Tab ──────────────────────────── */}
              {mode === "suggest" && (
                <div className="space-y-1">
                  {recsLoading && (
                    <div className="py-6 text-center space-y-1.5">
                      <span className="text-xs text-parish-gold animate-pulse block">Checking lectionary readings...</span>
                      <span className="text-[10px] text-stone-400 animate-pulse block" style={{ animationDelay: "0.3s" }}>Verifying against parish history...</span>
                      <span className="text-[10px] text-stone-400 animate-pulse block" style={{ animationDelay: "0.6s" }}>Scoring familiarity and recency...</span>
                    </div>
                  )}
                  {recs && recs.length === 0 && (
                    <p className="text-xs text-stone-400 italic py-4 text-center">
                      No suggestions for this slot.{" "}
                      <button onClick={() => setMode("search")} className="underline">Search instead</button>
                    </p>
                  )}
                  {recs?.map((rec) => {
                    const maxScore = recs[0]?.score || 1;
                    const normalized = Math.max(1, Math.round((rec.score / maxScore) * 10));
                    return (
                    <div key={rec.songId} className="rounded-lg border border-stone-100 hover:border-stone-200 transition-all">
                      <button
                        onClick={() => handleSelectSong(rec.title, rec.composer || "")}
                        className="w-full text-left px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-800 truncate">{rec.title}</p>
                            {rec.composer && (
                              <p className="text-xs text-stone-400 truncate">{rec.composer}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold text-parish-gold">{normalized}/10</span>
                            {rec.weeksSinceUsed !== null && (
                              <p className="text-[9px] text-stone-400">
                                {rec.weeksSinceUsed === 0 ? "used this week" : `${rec.weeksSinceUsed}w ago`}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Reason badges (one per type) */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {rec.reasons.filter((r, i, arr) => r.points > 0 && arr.findIndex((x) => x.type === r.type) === i).map((r, i) => (
                            <span key={i} className={`inline-flex items-center gap-0.5 px-1.5 py-0 text-[8px] font-medium rounded ${reasonColor(r.type)}`}>
                              {r.type === "scripture_match" && (
                                <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06V4.94a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3.75a9.006 9.006 0 00-4.25 1.065v12.005zM9.25 4.815A9.006 9.006 0 005 3.75a9.006 9.006 0 00-2.454.469A.75.75 0 002 4.94v10.12a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.815z"/></svg>
                              )}
                              {reasonLabel(r.type, r.detail)}
                            </span>
                          ))}
                          {rec.reasons.filter((r, i, arr) => r.points < 0 && arr.findIndex((x) => x.type === r.type) === i).map((r, i) => (
                            <span key={`neg-${i}`} className="inline-block px-1.5 py-0 text-[8px] font-medium rounded bg-red-50 text-red-500">
                              {reasonLabel(r.type)}
                            </span>
                          ))}
                        </div>
                      </button>
                      {/* See more / explain */}
                      <div className="px-3 pb-2 flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleExplain(rec); }}
                          className="text-[9px] text-stone-400 hover:text-parish-gold transition-colors"
                        >
                          {explainSong?.song?.title === rec.title ? "Hide" : "Why this song?"}
                        </button>
                        {rec.weeksUntilNext !== null && (
                          <span className="text-[9px] text-stone-300">
                            next in {rec.weeksUntilNext}w
                          </span>
                        )}
                      </div>
                      {/* "Why this song?" explanation panel */}
                      {explainSong?.song?.title === rec.title && (
                        <div className="px-3 pb-3 border-t border-stone-50 pt-2 space-y-2">
                          <p className="text-[10px] font-semibold text-parish-gold uppercase tracking-wider">
                            Why this song? ({explainSong.totalScore} pts)
                          </p>
                          <div className="space-y-1.5">
                            {explainSong.breakdown.map((b, i) => (
                              <div key={i} className="text-[10px]">
                                <div className="flex items-center justify-between">
                                  <span className={`font-medium ${b.points >= 0 ? "text-stone-700" : "text-red-500"}`}>
                                    {b.category === "scripture_match" ? "Scripture Match" :
                                     b.category === "topic_match" ? "Thematic Fit" :
                                     b.category === "season_match" ? "Seasonal" :
                                     b.category === "function_match" ? "Liturgical Function" :
                                     b.category === "familiarity" ? "Community Familiarity" :
                                     b.category === "recency_penalty" ? "Recency" :
                                     b.category}
                                  </span>
                                  <span className={`text-[9px] font-mono ${b.points >= 0 ? "text-green-600" : "text-red-500"}`}>
                                    {b.points >= 0 ? "+" : ""}{b.points}
                                  </span>
                                </div>
                                {b.explanation ? (
                                  <p className="text-stone-500 leading-snug mt-0.5">{b.explanation}</p>
                                ) : (
                                  <p className="text-stone-400 leading-snug mt-0.5">{b.detail}</p>
                                )}
                              </div>
                            ))}
                          </div>
                          {(explainSong.weeksSinceUsed !== null || explainSong.weeksUntilNext !== null) && (
                            <div className="text-[9px] text-stone-400 pt-1 border-t border-stone-100 flex gap-3">
                              {explainSong.weeksSinceUsed !== null && (
                                <span>Last used {explainSong.weeksSinceUsed}w ago</span>
                              )}
                              {explainSong.weeksUntilNext !== null && (
                                <span>Next in {explainSong.weeksUntilNext}w</span>
                              )}
                            </div>
                          )}
                          {/* Lyrics with reading highlights */}
                          {explainSong.lyrics && explainSong.lyrics.length > 0 && (
                            <div className="pt-2 border-t border-stone-100 space-y-2">
                              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Lyrics</p>
                              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                                {explainSong.lyrics.map((verse, vi) => {
                                  const isMatched = explainSong.matchedVerseLabel === verse.label;
                                  const verseLabel = verse.label === "Refrain" ? "Ref." : `${verse.label}.`;
                                  return (
                                    <div
                                      key={vi}
                                      className={`text-[9px] leading-relaxed rounded-md px-2 py-1.5 ${
                                        isMatched
                                          ? "bg-blue-50 border border-blue-100"
                                          : "bg-stone-25"
                                      }`}
                                    >
                                      <span className={`font-semibold mr-1 ${isMatched ? "text-blue-600" : "text-stone-400"}`}>
                                        {verseLabel}
                                      </span>
                                      <span className={isMatched ? "text-blue-900" : "text-stone-600"}>
                                        {highlightKeywords(
                                          verse.text.replace(/\n/g, " / "),
                                          explainSong.readingKeywords || []
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {explainLoading && explainSong === null && (
                        <div className="px-3 pb-2">
                          <span className="text-[9px] text-stone-400 animate-pulse">Loading explanation...</span>
                        </div>
                      )}
                    </div>
                  );})}
                </div>
              )}

              {/* ─── Search Tab ───────────────────────────────── */}
              {mode === "search" && (
                <>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Search songs..."
                    className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  {searching && <p className="text-xs text-stone-400 mt-2 px-1">Searching...</p>}
                  {results.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-stone-50">
                      {results.map((song) => (
                        <button
                          key={song.id}
                          type="button"
                          onClick={() => handleSelectSong(song.title, song.composer || "")}
                          className="w-full text-left px-2 py-2 hover:bg-stone-50 rounded transition-colors"
                        >
                          <p className="text-sm font-medium text-stone-800 truncate">{song.title}</p>
                          {song.composer && <p className="text-xs text-stone-400 truncate">{song.composer}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {query.trim() && !searching && results.length === 0 && (
                    <p className="text-xs text-stone-400 mt-2 px-1">
                      No songs found.{" "}
                      <button onClick={() => { setMode("manual"); setTitle(query); }} className="text-stone-600 underline">Enter manually</button>
                    </p>
                  )}
                </>
              )}

              {/* ─── Manual Tab ───────────────────────────────── */}
              {mode === "manual" && (
                <>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-medium text-stone-500 uppercase tracking-wide mb-0.5">Title</label>
                      <input ref={mode === "manual" ? inputRef : undefined} type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-sm border border-stone-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-400" placeholder="Song title" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-stone-500 uppercase tracking-wide mb-0.5">Composer</label>
                      <input type="text" value={composer} onChange={(e) => setComposer(e.target.value)} className="w-full text-sm border border-stone-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-400" placeholder="Composer/arranger" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-stone-400 uppercase">Note</label>
                      <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full text-sm border border-stone-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-400" placeholder="Optional note (e.g. key, occasion)" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-stone-400 uppercase">YouTube URL</label>
                      <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className="w-full text-sm border border-stone-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-400" placeholder="https://youtube.com/watch?v=..." />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {!currentData.isEmpty && (
                      <button onClick={handleClear} className="text-xs text-red-500 hover:text-red-700">Clear</button>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <button onClick={onClose} className="px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-100 rounded-md">Cancel</button>
                      <button onClick={handleManualSave} disabled={!title.trim()} className="px-3 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 disabled:opacity-50">Save</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
