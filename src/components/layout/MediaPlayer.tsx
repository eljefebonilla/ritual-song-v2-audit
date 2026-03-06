"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMedia } from "@/lib/media-context";
import { useUser } from "@/lib/user-context";
import { useAudioEngine } from "@/lib/audio-engine";
import {
  CHROMATIC_KEYS,
  semitoneOffset,
  transposedKeyName,
} from "@/lib/key-utils";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const ACCENT = "#4CAF50";

export default function MediaPlayer() {
  const {
    current,
    isOpen,
    isLoading,
    error,
    speed,
    pitchSemitones,
    volume,
    close,
    updateCurrent,
    setSpeed,
    setPitchSemitones,
    setVolume,
    setIsLoading,
    setError,
  } = useMedia();
  const { role } = useUser();
  const isAdmin = role === "admin";

  const [playing, setPlaying] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // A/B loop state (local, ephemeral)
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);

  // Key transposition state
  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [activeChartKey, setActiveChartKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  // Drag state for loop handles + scrub dragging
  const draggingRef = useRef<"A" | "B" | null>(null);
  const scrubbingRef = useRef(false);
  // Store the active scrub bar's rect on pointerDown so we always use the visible one
  const barRectRef = useRef<DOMRect | null>(null);

  const pctFromPointer = useCallback((clientX: number) => {
    const rect = barRectRef.current;
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const isAudio = current?.type === "audio";
  const url = isAudio ? current.url : null;

  const {
    currentTime,
    duration,
    percentPlayed,
    seek,
    scrubPreview,
    scrubStop,
    setTempoOverride,
    clearTempoOverride,
  } = useAudioEngine({
    url,
    playing,
    speed,
    pitchSemitones,
    volume,
    loopStart,
    loopEnd,
    onReady: useCallback(() => {
      setIsLoading(false);
      setPlaying(true);
    }, [setIsLoading]),
    onError: useCallback(
      (msg: string) => {
        setIsLoading(false);
        setError(msg);
        setPlaying(false);
      },
      [setIsLoading, setError]
    ),
    onEnd: useCallback(() => {
      setPlaying(false);
    }, []),
  });

  // Stable refs so the pointer useEffect doesn't churn
  const seekRef = useRef(seek);
  const scrubPreviewRef = useRef(scrubPreview);
  const scrubStopRef = useRef(scrubStop);
  seekRef.current = seek;
  scrubPreviewRef.current = scrubPreview;
  scrubStopRef.current = scrubStop;

  // --- Transport hold refs ---
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdActiveRef = useRef(false);
  const holdRafRef = useRef<number>(0);
  const holdPctRef = useRef(0);
  const holdDirRef = useRef<"rw" | "ff" | null>(null);
  const percentRef = useRef(percentPlayed);
  const speedValRef = useRef(speed);
  const durationRef = useRef(duration);
  percentRef.current = percentPlayed;
  speedValRef.current = speed;
  durationRef.current = duration;

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdActiveRef.current) {
      holdActiveRef.current = false;
      cancelAnimationFrame(holdRafRef.current);
      clearTempoOverride();
    }
    holdDirRef.current = null;
  }, [clearTempoOverride]);

  const handleTransportDown = useCallback(
    (dir: "rw" | "ff") => {
      cancelHold();
      holdDirRef.current = dir;
      holdActiveRef.current = false;
      holdTimerRef.current = setTimeout(() => {
        holdActiveRef.current = true;
        if (dir === "ff") {
          setTempoOverride(speedValRef.current * 3);
        } else {
          // Rewind: rAF loop stepping backward at ~3x
          holdPctRef.current = percentRef.current;
          let lastStep = 0;
          const step = (ts: number) => {
            if (!holdActiveRef.current) return;
            if (lastStep === 0) lastStep = ts;
            if (ts - lastStep >= 50) {
              const elapsed = (ts - lastStep) / 1000;
              lastStep = ts;
              const dur = durationRef.current;
              if (dur > 0) {
                holdPctRef.current = Math.max(
                  0,
                  holdPctRef.current - ((elapsed * 3) / dur) * 100
                );
                seekRef.current(holdPctRef.current);
              }
            }
            holdRafRef.current = requestAnimationFrame(step);
          };
          holdRafRef.current = requestAnimationFrame(step);
        }
      }, 300);
    },
    [cancelHold, setTempoOverride]
  );

  const handleTransportUp = useCallback(
    (dir: "rw" | "ff") => {
      if (holdDirRef.current !== dir) return;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (holdActiveRef.current) {
        // Was a hold — cleanup
        holdActiveRef.current = false;
        cancelAnimationFrame(holdRafRef.current);
        if (dir === "ff") clearTempoOverride();
      } else {
        // Was a tap — skip 10s
        const dur = durationRef.current;
        if (dur > 0) {
          const skipPct = (10 / dur) * 100;
          const pct = percentRef.current;
          seekRef.current(
            dir === "rw"
              ? Math.max(0, pct - skipPct)
              : Math.min(100, pct + skipPct)
          );
        }
      }
      holdDirRef.current = null;
    },
    [clearTempoOverride]
  );

  const handleTransportLeave = useCallback(() => {
    cancelHold();
  }, [cancelHold]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Loop handle dragging
      const which = draggingRef.current;
      if (which) {
        const pct = pctFromPointer(e.clientX);
        if (which === "A") {
          const cap = loopEnd !== null ? loopEnd - 1 : 99;
          setLoopStart(Math.min(pct, cap));
        } else {
          const floor = loopStart !== null ? loopStart + 1 : 1;
          setLoopEnd(Math.max(pct, floor));
        }
        return;
      }
      // Scrub dragging — update position + play raw audio snippet
      if (scrubbingRef.current) {
        const pct = pctFromPointer(e.clientX);
        seekRef.current(pct);
        scrubPreviewRef.current(pct);
      }
    };
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = null;
      }
      if (scrubbingRef.current) {
        scrubbingRef.current = false;
        scrubStopRef.current();
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [pctFromPointer, loopStart, loopEnd]);

  // Clean up hold on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      cancelAnimationFrame(holdRafRef.current);
    };
  }, []);

  // Stable refs for keyboard shortcut handlers
  const handleSetARef = useRef(() => {});
  const handleSetBRef = useRef(() => {});
  const pitchRef = useRef(pitchSemitones);
  pitchRef.current = pitchSemitones;

  // --- Keyboard shortcuts (only when player is open with audio) ---
  useEffect(() => {
    if (!isOpen || !isAudio) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      switch (e.key) {
        case " ": // Spacebar → play/pause
          e.preventDefault();
          setPlaying((p) => !p);
          break;
        case "ArrowUp":
        case "+":
        case "=":
          e.preventDefault();
          setPitchSemitones(Math.min(12, pitchRef.current + 1));
          setActiveChartKey(null);
          break;
        case "ArrowDown":
        case "-":
          e.preventDefault();
          setPitchSemitones(Math.max(-12, pitchRef.current - 1));
          setActiveChartKey(null);
          break;
        case "a":
        case "A":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleSetARef.current();
          }
          break;
        case "b":
        case "B":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleSetBRef.current();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isAudio, setPitchSemitones]);

  // Reset loop, key, and playing state when song changes
  const prevUrlRef = useState<string | null>(null);
  if (url !== prevUrlRef[0]) {
    prevUrlRef[1](url);
    setLoopStart(null);
    setLoopEnd(null);
    setPlaying(false);
    setActiveChartKey(null);
    setShowKeyPicker(false);
    cancelHold();
  }

  if (!isOpen || !current) return null;

  const isYouTube = current.type === "youtube";
  const youtubeId = isYouTube ? extractYouTubeId(current.url) : null;
  const progress = percentPlayed;

  // --- Handlers ---
  const togglePlay = () => {
    if (isLoading) return;
    setPlaying((p) => !p);
  };

  const handleScrubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.preventDefault();
    // Capture the rect of the actual visible scrub bar being interacted with
    barRectRef.current = e.currentTarget.getBoundingClientRect();
    scrubbingRef.current = true;
    const pct = pctFromPointer(e.clientX);
    seek(pct);
    scrubPreview(pct);
  };

  const handleSetA = () => {
    setLoopStart(percentPlayed);
    if (loopEnd !== null && percentPlayed >= loopEnd) {
      setLoopEnd(null);
    }
  };

  const handleSetB = () => {
    if (loopStart === null) return;
    if (percentPlayed > loopStart) {
      setLoopEnd(percentPlayed);
    }
  };

  // Keep refs in sync for keyboard shortcuts
  handleSetARef.current = handleSetA;
  handleSetBRef.current = handleSetB;

  const handleClearLoop = () => {
    setLoopStart(null);
    setLoopEnd(null);
  };

  const loopActive = loopStart !== null && loopEnd !== null;

  // --- Transport button helper ---
  const transportBtn = (dir: "rw" | "ff", iconSize = 18) => (
    <button
      onPointerDown={() => handleTransportDown(dir)}
      onPointerUp={() => handleTransportUp(dir)}
      onPointerLeave={handleTransportLeave}
      aria-label={dir === "rw" ? "Rewind" : "Fast forward"}
      className="w-8 h-8 flex items-center justify-center rounded text-stone-500 hover:bg-stone-300/50 transition-colors select-none touch-none"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {dir === "rw" ? (
          <>
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </>
        ) : (
          <>
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </>
        )}
      </svg>
    </button>
  );

  // --- Shared UI Pieces ---
  const playPauseBtn = (
    <button
      onClick={togglePlay}
      className="w-10 h-10 flex items-center justify-center rounded-full shrink-0 transition-all active:scale-95"
      style={{
        background: playing
          ? `linear-gradient(145deg, ${ACCENT}20, ${ACCENT}10)`
          : `linear-gradient(145deg, ${ACCENT}0a, transparent)`,
        border: `2px solid ${ACCENT}`,
        boxShadow: playing
          ? `0 0 8px ${ACCENT}30, 0 1px 4px ${ACCENT}20`
          : `0 1px 4px ${ACCENT}15`,
      }}
    >
      {isLoading ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          className="animate-spin"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.5"
        >
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
      ) : playing ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.5"
        >
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.5"
          strokeLinejoin="round"
        >
          <polygon points="6,3 20,12 6,21" />
        </svg>
      )}
    </button>
  );

  const cassetteIcon = (
    <div
      className="rounded-xl p-5 flex items-center justify-center"
      style={{
        background: "linear-gradient(180deg, #e7e5e4, #f5f5f4)",
        boxShadow:
          "inset 0 2px 4px rgba(0,0,0,0.1), inset 0 -1px 2px rgba(255,255,255,0.5)",
      }}
    >
      <svg
        width="72"
        height="48"
        viewBox="0 0 72 48"
        fill="none"
        className="text-stone-400"
      >
        {/* Body */}
        <rect
          x="1"
          y="1"
          width="70"
          height="46"
          rx="3.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* Label area */}
        <rect
          x="8"
          y="5"
          width="56"
          height="17"
          rx="2"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.4"
        />
        {/* Label lines */}
        <line
          x1="14"
          y1="10"
          x2="58"
          y2="10"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.2"
        />
        <line
          x1="14"
          y1="13.5"
          x2="58"
          y2="13.5"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.2"
        />
        <line
          x1="14"
          y1="17"
          x2="42"
          y2="17"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.2"
        />
        {/* Tape window */}
        <rect
          x="14"
          y="26"
          width="44"
          height="12"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* Left reel */}
        <circle
          cx="26"
          cy="32"
          r="4.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <circle cx="26" cy="32" r="1.5" fill="currentColor" opacity="0.6" />
        {/* Right reel */}
        <circle
          cx="46"
          cy="32"
          r="4.5"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <circle cx="46" cy="32" r="1.5" fill="currentColor" opacity="0.6" />
        {/* Tape path */}
        <path
          d="M30.5 32 L41.5 32"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.3"
        />
        {/* Bottom guides */}
        <rect
          x="20"
          y="40"
          width="10"
          height="4"
          rx="1"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.25"
        />
        <rect
          x="42"
          y="40"
          width="10"
          height="4"
          rx="1"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.25"
        />
        {/* Screw holes */}
        <circle
          cx="6"
          cy="5"
          r="1.5"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.2"
        />
        <circle
          cx="66"
          cy="5"
          r="1.5"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.2"
        />
      </svg>
    </div>
  );

  const transportStrip = (
    <div
      className="flex items-center justify-center gap-4 py-2 px-6 rounded-lg"
      style={{
        background: "linear-gradient(180deg, #e7e5e4, #d6d3d1)",
        boxShadow:
          "inset 0 1px 3px rgba(0,0,0,0.12), inset 0 -1px 1px rgba(255,255,255,0.4)",
      }}
    >
      {transportBtn("rw")}
      {playPauseBtn}
      {transportBtn("ff")}
    </div>
  );

  const scrubBar = (
    <div className="w-full space-y-1">
      <div
        className="w-full h-2 bg-stone-200 rounded-full cursor-pointer group relative touch-none"
        onPointerDown={handleScrubDown}
      >
        {/* A/B loop highlight */}
        {loopActive && (
          <div
            className="absolute top-0 h-full rounded-full opacity-25"
            style={{
              left: `${loopStart}%`,
              width: `${loopEnd! - loopStart!}%`,
              backgroundColor: ACCENT,
            }}
          />
        )}
        {/* A handle (draggable) */}
        {loopStart !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 touch-none"
            style={{ left: `${loopStart}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // Capture the parent bar rect for drag calculations
              barRectRef.current = (
                e.currentTarget.parentElement as HTMLElement
              ).getBoundingClientRect();
              draggingRef.current = "A";
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
          >
            {/* Visible dot */}
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm cursor-grab active:cursor-grabbing"
              style={{ backgroundColor: ACCENT }}
            />
            {/* Invisible larger hit area */}
            <div className="absolute -inset-2" />
          </div>
        )}
        {/* B handle (draggable) */}
        {loopEnd !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 touch-none"
            style={{ left: `${loopEnd}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              barRectRef.current = (
                e.currentTarget.parentElement as HTMLElement
              ).getBoundingClientRect();
              draggingRef.current = "B";
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm cursor-grab active:cursor-grabbing"
              style={{ backgroundColor: ACCENT }}
            />
            <div className="absolute -inset-2" />
          </div>
        )}
        {/* Progress fill */}
        <div
          className="h-full rounded-full relative transition-[width] duration-100"
          style={{ width: `${progress}%`, backgroundColor: ACCENT }}
        >
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: ACCENT }}
          />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-stone-400 tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );

  const errorDisplay = error && (
    <p className="text-xs text-red-500 mt-1">{error}</p>
  );

  const practiceControls = (
    <div className="space-y-2 pt-1">
      {/* Speed row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-stone-400 w-10 shrink-0">Speed</span>
        <input
          type="range"
          min={0.6}
          max={1}
          step={0.01}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-green-600"
        />
        <span className="text-[10px] text-stone-400 w-10 text-right tabular-nums">
          {Math.round(speed * 100)}%
        </span>
        {speed < 1 && (
          <button
            onClick={() => setSpeed(1)}
            className="text-[10px] text-stone-400 hover:text-stone-600 underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Key row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-stone-400 w-10 shrink-0">Key</span>
        <button
          onClick={(e) => {
            setPitchSemitones(pitchSemitones - 1);
            setActiveChartKey(null);
            (e.currentTarget as HTMLElement).blur();
          }}
          disabled={pitchSemitones <= -12}
          className="w-7 h-7 rounded border border-stone-300 flex items-center justify-center text-stone-500 hover:bg-stone-50 disabled:opacity-30 text-sm font-bold"
        >
          −
        </button>
        <span className="text-xs font-mono w-8 text-center text-stone-700">
          {current?.recordedKey
            ? (transposedKeyName(current.recordedKey, pitchSemitones) || String(pitchSemitones))
            : pitchSemitones > 0
              ? `+${pitchSemitones}`
              : String(pitchSemitones)}
        </span>
        <button
          onClick={(e) => {
            setPitchSemitones(pitchSemitones + 1);
            setActiveChartKey(null);
            (e.currentTarget as HTMLElement).blur();
          }}
          disabled={pitchSemitones >= 12}
          className="w-7 h-7 rounded border border-stone-300 flex items-center justify-center text-stone-500 hover:bg-stone-50 disabled:opacity-30 text-sm font-bold"
        >
          +
        </button>
        {pitchSemitones !== 0 && (
          <button
            onClick={() => {
              setPitchSemitones(0);
              setActiveChartKey(null);
            }}
            className="text-[10px] text-stone-400 hover:text-stone-600 underline"
          >
            Reset
          </button>
        )}
        {/* Admin recorded key picker */}
        {isAdmin && current?.songId && (
          <div className="relative ml-auto">
            <button
              onClick={() => setShowKeyPicker((v) => !v)}
              className="px-2 py-0.5 rounded text-[10px] font-medium border border-stone-300 text-stone-500 hover:bg-stone-50 transition-colors"
            >
              {current.recordedKey ? `Rec: ${current.recordedKey}` : "Set key"}
              {" ▾"}
            </button>
            {showKeyPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-lg shadow-lg p-2 w-[200px]">
                <div className="grid grid-cols-4 gap-1">
                  {CHROMATIC_KEYS.map((k) => (
                    <button
                      key={k}
                      disabled={savingKey}
                      onClick={async () => {
                        const newKey = k === current.recordedKey ? "" : k;
                        setSavingKey(true);
                        try {
                          const res = await fetch(`/api/songs/${current.songId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ recordedKey: newKey }),
                          });
                          if (res.ok) {
                            updateCurrent({ recordedKey: newKey || undefined });
                            setActiveChartKey(null);
                            setPitchSemitones(0);
                          }
                        } finally {
                          setSavingKey(false);
                          setShowKeyPicker(false);
                        }
                      }}
                      className={`px-1.5 py-1 rounded text-xs font-medium transition-colors ${
                        k === current.recordedKey
                          ? "bg-green-600 text-white"
                          : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart key chips — only when recorded key AND chart keys exist */}
      {current?.recordedKey && current.chartKeys && current.chartKeys.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-stone-400 w-10 shrink-0">Charts</span>
          <div className="flex flex-wrap gap-1">
            {current.chartKeys.map((ck) => {
              const offset = semitoneOffset(current.recordedKey!, ck);
              const isActive = activeChartKey === ck;
              return (
                <button
                  key={ck}
                  title={offset !== null ? `${offset > 0 ? "+" : ""}${offset} semitones` : ck}
                  onClick={() => {
                    if (isActive) {
                      setPitchSemitones(0);
                      setActiveChartKey(null);
                    } else if (offset !== null) {
                      setPitchSemitones(offset);
                      setActiveChartKey(ck);
                    }
                  }}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                    isActive
                      ? "bg-green-600 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {ck}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hint for admin when chart keys exist but no recorded key */}
      {isAdmin && current?.songId && !current.recordedKey && current.chartKeys && current.chartKeys.length > 0 && (
        <p className="text-[10px] text-stone-400 italic pl-12">
          Set the recorded key to enable one-click transposition
        </p>
      )}

      {/* Volume row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-stone-400 w-10 shrink-0">Vol</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-green-600"
        />
        <span className="text-[10px] text-stone-400 w-8 text-right tabular-nums">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* A/B Loop row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-stone-400 w-10 shrink-0">Loop</span>
        <button
          onClick={handleSetA}
          className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
          style={{
            backgroundColor:
              loopStart !== null ? ACCENT : "transparent",
            color: loopStart !== null ? "white" : "#78716c",
            border: `1px solid ${loopStart !== null ? ACCENT : "#d6d3d1"}`,
          }}
        >
          A
        </button>
        <button
          onClick={handleSetB}
          disabled={loopStart === null}
          className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors disabled:opacity-30"
          style={{
            backgroundColor:
              loopEnd !== null ? ACCENT : "transparent",
            color: loopEnd !== null ? "white" : "#78716c",
            border: `1px solid ${loopEnd !== null ? ACCENT : "#d6d3d1"}`,
          }}
        >
          B
        </button>
        {loopActive && (
          <span className="text-[10px] text-stone-400 italic">drag to adjust</span>
        )}
        {(loopStart !== null || loopEnd !== null) && (
          <button
            onClick={handleClearLoop}
            className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors border border-stone-300 text-stone-500 hover:bg-stone-100"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );

  // --- Desktop side panel ---
  const desktopPanel = (
    <div
      className="hidden md:flex fixed inset-y-0 right-0 w-[400px] border-l border-stone-200 shadow-xl z-30 flex-col"
      style={{ background: "linear-gradient(180deg, #fafaf9, #f5f5f4)" }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between shrink-0 bg-stone-50/50">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-stone-900 truncate">
            {current.title}
          </p>
          {current.subtitle && (
            <p className="text-xs text-stone-400 truncate">
              {current.subtitle}
            </p>
          )}
        </div>
        <button
          onClick={close}
          className="p-1 text-stone-400 hover:text-stone-600 shrink-0 ml-2"
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

      <div className="flex-1 flex items-center justify-center p-6">
        {isYouTube && youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
            className="w-full aspect-video rounded-lg"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <div className="w-full flex flex-col items-center gap-4">
            {/* Deck well */}
            <div
              className="w-full rounded-xl p-5 flex flex-col items-center gap-3"
              style={{
                background: "linear-gradient(180deg, #e7e5e4, #f5f5f4)",
                boxShadow: "inset 0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              {cassetteIcon}
              {transportStrip}
            </div>
            {scrubBar}
            {errorDisplay}
            {practiceControls}
          </div>
        )}
      </div>
    </div>
  );

  // --- Mobile bottom sheet ---
  const mobileSheet = (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 border-t border-stone-200 shadow-xl z-30"
      style={{ background: "linear-gradient(180deg, #f5f5f4, #fafaf9)" }}
    >
      {isYouTube && youtubeId ? (
        <>
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-stone-900 truncate">
                {current.title}
              </p>
            </div>
            <button
              onClick={close}
              className="p-1 text-stone-400 hover:text-stone-600 ml-2"
            >
              <svg
                width="14"
                height="14"
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
          <div className="px-4 pb-4">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
              className="w-full aspect-video rounded-lg"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </>
      ) : (
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            {/* Transport group */}
            <div className="flex items-center gap-0.5 shrink-0">
              {transportBtn("rw", 16)}
              {playPauseBtn}
              {transportBtn("ff", 16)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-stone-900 truncate">
                {current.title}
              </p>
              {current.subtitle && (
                <p className="text-[10px] text-stone-400 truncate">
                  {current.subtitle}
                </p>
              )}
            </div>
            {/* Expand toggle */}
            <button
              onClick={() => setMobileExpanded((e) => !e)}
              className="p-1 text-stone-400 hover:text-stone-600 shrink-0"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${mobileExpanded ? "rotate-180" : ""}`}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <button
              onClick={close}
              className="p-1 text-stone-400 hover:text-stone-600 shrink-0"
            >
              <svg
                width="14"
                height="14"
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
          {scrubBar}
          {errorDisplay}
          {mobileExpanded && practiceControls}
        </div>
      )}
    </div>
  );

  return (
    <>
      {desktopPanel}
      {mobileSheet}
    </>
  );
}
