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

// Note frequencies for octave 4 (A4=440)
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFrequency(noteIndex: number, octave: number): number {
  const midi = 12 * (octave + 1) + noteIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function MiniPiano() {
  const [octave, setOctave] = useState(4);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playNote = useCallback((noteIndex: number) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    const freq = noteFrequency(noteIndex, octave);
    const now = ctx.currentTime;

    // Piano tone: fundamental + 3 harmonics with hammer-like envelope
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.18, now + 0.005);
    master.gain.exponentialRampToValueAtTime(0.08, now + 0.15);
    master.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    const harmonics = [
      { type: "triangle" as OscillatorType, mult: 1, vol: 1 },
      { type: "sine" as OscillatorType, mult: 2, vol: 0.3 },
      { type: "sine" as OscillatorType, mult: 3, vol: 0.08 },
    ];
    for (const h of harmonics) {
      const g = ctx.createGain();
      g.gain.value = h.vol;
      g.connect(master);
      const o = ctx.createOscillator();
      o.type = h.type;
      o.frequency.value = freq * h.mult;
      o.connect(g);
      o.start(now);
      o.stop(now + 1.5);
    }

    setActiveNote(noteIndex);
    setTimeout(() => setActiveNote(null), 150);
  }, [octave]);

  const whiteKeys = [0, 2, 4, 5, 7, 9, 11];
  const blackKeyData: { noteIndex: number; afterWhite: number }[] = [
    { noteIndex: 1, afterWhite: 0 },  // C#
    { noteIndex: 3, afterWhite: 1 },  // D#
    { noteIndex: 6, afterWhite: 3 },  // F#
    { noteIndex: 8, afterWhite: 4 },  // G#
    { noteIndex: 10, afterWhite: 5 }, // A#
  ];

  const WHITE_LABELS = ["C", "D", "E", "F", "G", "A", "B"];
  const keyW = 32; // px per white key
  const totalW = whiteKeys.length * keyW + (whiteKeys.length - 1) * 1.5; // keys + gaps
  const keyH = 72; // px tall

  return (
    <div className="flex items-center gap-1.5">
      {/* Octave selector -- left of keyboard, vertical */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => setOctave((o) => Math.min(6, o + 1))}
          className="w-5 h-5 rounded border border-stone-600 flex items-center justify-center text-stone-400 hover:bg-stone-700 text-[9px]"
        >
          ▲
        </button>
        <span className="text-[10px] text-stone-400 font-medium leading-tight">C{octave}</span>
        <button
          onClick={() => setOctave((o) => Math.max(2, o - 1))}
          className="w-5 h-5 rounded border border-stone-600 flex items-center justify-center text-stone-400 hover:bg-stone-700 text-[9px]"
        >
          ▼
        </button>
      </div>
      {/* Keyboard */}
      <div
        className="relative select-none shrink-0"
        style={{
          width: totalW + 6,
          height: keyH + 6,
          borderRadius: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.18), inset 0 -1px 0 rgba(0,0,0,0.1)",
          background: "#1a1a1a",
          padding: 3,
        }}
      >
        {/* White keys */}
        <div className="flex h-full" style={{ gap: 1.5 }}>
          {whiteKeys.map((noteIdx, i) => {
            const pressed = activeNote === noteIdx;
            return (
              <button
                key={noteIdx}
                onPointerDown={() => playNote(noteIdx)}
                className="flex items-end justify-center"
                style={{
                  width: keyW,
                  height: keyH,
                  borderRadius: "0 0 4px 4px",
                  background: pressed
                    ? "linear-gradient(180deg, #d9d9d9 0%, #c8c8c8 100%)"
                    : "linear-gradient(180deg, #fefefe 0%, #f0efe9 60%, #e8e6e0 100%)",
                  boxShadow: pressed
                    ? "inset 0 1px 3px rgba(0,0,0,0.25)"
                    : "0 1px 0 rgba(0,0,0,0.15), inset 0 -1px 0 rgba(0,0,0,0.04), inset 0 0 0 0.5px rgba(0,0,0,0.08)",
                  transform: pressed ? "translateY(1px)" : "none",
                  paddingBottom: 5,
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 600, color: pressed ? "#888" : "#aaa", lineHeight: 1 }}>
                  {WHITE_LABELS[i]}
                </span>
              </button>
            );
          })}
        </div>
        {/* Black keys */}
        {blackKeyData.map(({ noteIndex, afterWhite }) => {
          const pressed = activeNote === noteIndex;
          const leftPx = 3 + (afterWhite + 1) * (keyW + 1.5) - 10;
          return (
            <button
              key={noteIndex}
              onPointerDown={() => playNote(noteIndex)}
              className="absolute z-10"
              style={{
                left: leftPx,
                width: 20,
                top: 3,
                height: keyH * 0.58,
                borderRadius: "0 0 3px 3px",
                background: pressed
                  ? "linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%)"
                  : "linear-gradient(180deg, #333 0%, #1a1a1a 70%, #111 100%)",
                boxShadow: pressed
                  ? "inset 0 1px 2px rgba(0,0,0,0.5)"
                  : "0 2px 3px rgba(0,0,0,0.4), inset 0 -2px 1px rgba(255,255,255,0.05), inset 0 0 0 0.5px rgba(0,0,0,0.3)",
                transform: pressed ? "translateY(1px)" : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

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

  // Metronome state
  const [metroBpm, setMetroBpm] = useState(120);
  const [metroPlaying, setMetroPlaying] = useState(false);
  const metroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metroAudioCtxRef = useRef<AudioContext | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  // Drag state for loop handles + scrub dragging
  const draggingRef = useRef<"A" | "B" | null>(null);
  const scrubbingRef = useRef(false);
  // Store the active scrub bar's rect on pointerDown so we always use the visible one
  const barRectRef = useRef<DOMRect | null>(null);

  // Metronome tick
  const metroTick = useCallback(() => {
    if (!metroAudioCtxRef.current) {
      metroAudioCtxRef.current = new AudioContext();
    }
    const ctx = metroAudioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "square";
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }, []);

  const toggleMetronome = useCallback(() => {
    if (metroPlaying) {
      if (metroIntervalRef.current) clearInterval(metroIntervalRef.current);
      metroIntervalRef.current = null;
      setMetroPlaying(false);
    } else {
      metroTick();
      metroIntervalRef.current = setInterval(metroTick, 60000 / metroBpm);
      setMetroPlaying(true);
    }
  }, [metroPlaying, metroBpm, metroTick]);

  // Restart interval when BPM changes while playing
  useEffect(() => {
    if (metroPlaying && metroIntervalRef.current) {
      clearInterval(metroIntervalRef.current);
      metroIntervalRef.current = setInterval(metroTick, 60000 / metroBpm);
    }
  }, [metroBpm, metroPlaying, metroTick]);

  // Cleanup metronome on close
  useEffect(() => {
    if (!isOpen && metroIntervalRef.current) {
      clearInterval(metroIntervalRef.current);
      metroIntervalRef.current = null;
      setMetroPlaying(false);
    }
  }, [isOpen]);

  const handleTapTempo = useCallback(() => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    // Reset if last tap was > 2s ago
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      tapTimesRef.current = [now];
      return;
    }
    taps.push(now);
    if (taps.length > 6) taps.shift();
    if (taps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avg);
      if (bpm >= 30 && bpm <= 300) setMetroBpm(bpm);
    }
  }, []);

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

  // Auto-expand for YouTube so the iframe renders immediately
  useEffect(() => {
    if (current?.type === "youtube") {
      setMobileExpanded(true);
    }
  }, [current?.url]); // eslint-disable-line react-hooks/exhaustive-deps

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
      className="w-8 h-8 flex items-center justify-center rounded text-stone-600 hover:text-[#800000] transition-colors select-none touch-none"
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
          ? "linear-gradient(145deg, #292524, #1c1917)"
          : "#292524",
        border: "none",
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        color: "white",
      }}
    >
      {isLoading ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          className="animate-spin"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
        >
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
      ) : playing ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="white"
          stroke="white"
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
          fill="white"
          stroke="white"
          strokeWidth="2.5"
          strokeLinejoin="round"
        >
          <polygon points="6,3 20,12 6,21" />
        </svg>
      )}
    </button>
  );

  const scrubBar = (
    <div className="w-full space-y-1">
      <div
        className="w-full h-1.5 bg-stone-200 rounded-full cursor-pointer group relative touch-none"
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
      <div className="flex justify-between text-[10px] text-stone-400 font-bold tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );

  const errorDisplay = error && (
    <p className="text-xs text-red-500 mt-1">{error}</p>
  );

  // --- Controls stack: Key + Loop (transport stays in collapsed strip) ---
  const controlsStack = (
    <div className="space-y-1.5">
      {/* Key row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-stone-400 uppercase w-10 shrink-0">Key</span>
        <button
          onClick={(e) => { setPitchSemitones(pitchSemitones - 1); setActiveChartKey(null); (e.currentTarget as HTMLElement).blur(); }}
          disabled={pitchSemitones <= -12}
          className="w-6 h-6 rounded border border-stone-600 flex items-center justify-center text-stone-300 hover:bg-stone-700 disabled:opacity-30 text-sm font-bold"
        >
          −
        </button>
        <span className="text-xs font-mono w-8 text-center text-stone-200 tabular-nums">
          {current?.recordedKey
            ? (transposedKeyName(current.recordedKey, pitchSemitones) || String(pitchSemitones))
            : pitchSemitones > 0 ? `+${pitchSemitones}` : String(pitchSemitones)}
        </span>
        <button
          onClick={(e) => { setPitchSemitones(pitchSemitones + 1); setActiveChartKey(null); (e.currentTarget as HTMLElement).blur(); }}
          disabled={pitchSemitones >= 12}
          className="w-6 h-6 rounded border border-stone-600 flex items-center justify-center text-stone-300 hover:bg-stone-700 disabled:opacity-30 text-sm font-bold"
        >
          +
        </button>
        {pitchSemitones !== 0 && (
          <button onClick={() => { setPitchSemitones(0); setActiveChartKey(null); }} className="text-[10px] text-stone-500 hover:text-stone-300 underline">
            Reset
          </button>
        )}
        {/* Admin recorded key picker */}
        {isAdmin && current?.songId && (
          <div className="relative ml-auto">
            <button
              onClick={() => setShowKeyPicker((v) => !v)}
              className="px-2 py-0.5 rounded text-[10px] font-medium border border-stone-600 text-stone-400 hover:bg-stone-700 transition-colors"
            >
              {current.recordedKey ? `Rec: ${current.recordedKey}` : "Set key"}{" \u25BE"}
            </button>
            {showKeyPicker && (
              <div className="absolute right-0 bottom-full mb-1 z-50 bg-stone-700 border border-stone-600 rounded-lg shadow-lg p-2 w-[200px]">
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
                        k === current.recordedKey ? "bg-green-600 text-white" : "bg-stone-600 text-stone-200 hover:bg-stone-500"
                      }`}
                    >{k}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart key chips */}
      {current?.recordedKey && current.chartKeys && current.chartKeys.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-stone-400 uppercase w-10 shrink-0">Charts</span>
          <div className="flex flex-wrap gap-1">
            {current.chartKeys.map((ck) => {
              const offset = semitoneOffset(current.recordedKey!, ck);
              const isActive = activeChartKey === ck;
              return (
                <button
                  key={ck}
                  title={offset !== null ? `${offset > 0 ? "+" : ""}${offset} semitones` : ck}
                  onClick={() => {
                    if (isActive) { setPitchSemitones(0); setActiveChartKey(null); }
                    else if (offset !== null) { setPitchSemitones(offset); setActiveChartKey(ck); }
                  }}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                    isActive ? "bg-green-600 text-white" : "bg-stone-700 text-stone-300 hover:bg-stone-600"
                  }`}
                >{ck}</button>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin hint */}
      {isAdmin && current?.songId && !current.recordedKey && current.chartKeys && current.chartKeys.length > 0 && (
        <p className="text-[10px] text-stone-500 italic pl-12">Set the recorded key to enable one-click transposition</p>
      )}

      {/* Loop row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-stone-400 uppercase w-10 shrink-0">Loop</span>
        <button
          onClick={handleSetA}
          className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
          style={{
            backgroundColor: loopStart !== null ? ACCENT : "transparent",
            color: loopStart !== null ? "white" : "#a8a29e",
            border: `1px solid ${loopStart !== null ? ACCENT : "#57534e"}`,
          }}
        >A</button>
        <button
          onClick={handleSetB}
          disabled={loopStart === null}
          className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors disabled:opacity-30"
          style={{
            backgroundColor: loopEnd !== null ? ACCENT : "transparent",
            color: loopEnd !== null ? "white" : "#a8a29e",
            border: `1px solid ${loopEnd !== null ? ACCENT : "#57534e"}`,
          }}
        >B</button>
        {loopActive && <span className="text-[10px] text-stone-500 italic">drag to adjust</span>}
        {(loopStart !== null || loopEnd !== null) && (
          <button onClick={handleClearLoop} className="px-2 py-0.5 rounded text-[11px] font-medium border border-stone-600 text-stone-400 hover:bg-stone-700">
            Clear
          </button>
        )}
      </div>
    </div>
  );

  // --- Sliders stack: Playback scrub + Speed + Volume ---
  const slidersStack = (
    <div className="space-y-1.5 flex-1 min-w-0">
      {/* Playback scrub bar */}
      {scrubBar}

      {/* Speed row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-stone-400 uppercase w-10 shrink-0">Speed</span>
        <input
          type="range"
          min={0.6}
          max={1}
          step={0.01}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-[#B8A472]"
        />
        <span className="text-[10px] font-bold text-[#B8A472] tabular-nums w-8 text-right">
          {speed < 1 ? `${speed.toFixed(2)}x` : "1x"}
        </span>
      </div>

      {/* Volume row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-stone-400 uppercase w-10 shrink-0">Vol</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-stone-500"
        />
        <span className="text-[10px] text-stone-400 w-8 text-right tabular-nums">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );

  // --- Right column: Metronome + Piano ---
  const rightControls = (
    <div className="flex items-stretch gap-3 shrink-0">
      {/* Metronome block */}
      <div className="flex items-center gap-3 bg-stone-700/50 px-4 py-3 rounded-lg">
        {/* Play/stop button */}
        <button
          onClick={toggleMetronome}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95"
          style={{
            background: metroPlaying ? ACCENT : "#44403c",
            boxShadow: metroPlaying ? `0 0 10px ${ACCENT}60` : "0 1px 3px rgba(0,0,0,0.3)",
          }}
          title={metroPlaying ? "Stop metronome" : "Start metronome"}
        >
          {metroPlaying ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="3">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2.5" strokeLinejoin="round">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>
        {/* BPM display -- fixed width so layout doesn't shift */}
        <div className="flex flex-col items-center w-12">
          <span className="text-2xl font-mono font-bold text-white leading-none tabular-nums text-center">
            {metroBpm}
          </span>
          <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">BPM</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <button
              onClick={() => setMetroBpm((b) => Math.max(30, b - 5))}
              className="w-7 h-6 bg-stone-700 text-white text-[10px] rounded hover:bg-stone-600 font-bold"
            >
              -5
            </button>
            <button
              onClick={() => setMetroBpm((b) => Math.min(300, b + 5))}
              className="w-7 h-6 bg-stone-700 text-white text-[10px] rounded hover:bg-stone-600 font-bold"
            >
              +5
            </button>
          </div>
          <button
            onClick={handleTapTempo}
            className="w-full h-7 bg-stone-200 text-stone-900 text-[10px] font-black rounded hover:bg-white active:bg-stone-400 transition-colors tracking-tighter"
          >
            TAP
          </button>
        </div>
      </div>

      {/* Piano */}
      <div className="bg-stone-700/50 rounded-lg p-2 flex items-center">
        <MiniPiano />
      </div>
    </div>
  );


  // --- Shared chrome buttons (expand + close) ---
  // --- Unified bottom strip (Stitch: two-half layout) ---
  const bottomStrip = (
    <div
      className="fixed bottom-0 inset-x-0 md:ml-64 border-t border-[#e7e5e3] z-30"
      style={{
        background: "linear-gradient(180deg, #f5f5f4, #fafaf9)",
        boxShadow: "0 -4px 10px rgba(0,0,0,0.05)",
      }}
    >
      {isYouTube && youtubeId ? (
        <>
          <div className="px-6 py-2 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-stone-800 truncate font-headline">
                {current.title}
              </p>
              {current.subtitle && (
                <p className="text-xs text-stone-500 truncate font-headline">
                  {current.subtitle}
                </p>
              )}
            </div>
            <button
              onClick={() => setMobileExpanded((e) => !e)}
              className="p-1 text-stone-400 hover:text-stone-600 shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform ${mobileExpanded ? "rotate-180" : ""}`}
              ><polyline points="18 15 12 9 6 15" /></svg>
            </button>
            <button onClick={close} className="p-1 text-stone-400 hover:text-stone-600 ml-1 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {mobileExpanded && (
            <div className="px-6 pb-4">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                className="w-full max-w-xl mx-auto aspect-video rounded-lg"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          )}
        </>
      ) : (
        <div className="px-4 py-2.5">
          {/* Collapsed: transport + title + scrub + expand/close */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 shrink-0">
              {transportBtn("rw", 16)}
              {playPauseBtn}
              {transportBtn("ff", 16)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-stone-800 truncate">{current.title}</p>
              {current.subtitle && <p className="text-[10px] text-stone-500 truncate">{current.subtitle}</p>}
            </div>
            <button
              onClick={() => setMobileExpanded((e) => !e)}
              className="p-1 text-stone-400 hover:text-stone-600 shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform ${mobileExpanded ? "rotate-180" : ""}`}
              ><polyline points="18 15 12 9 6 15" /></svg>
            </button>
            <button onClick={close} className="p-1 text-stone-400 hover:text-stone-600 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {!mobileExpanded && scrubBar}
          {errorDisplay}

          {/* Expanded: unified module with inset panels */}
          {mobileExpanded && (
            <div className="bg-stone-800 rounded-lg p-3 mt-3">
              <div className="flex items-stretch gap-3">
                {/* Controls panel: Key + Loop | Scrub + Speed + Vol */}
                <div className="bg-stone-700/50 rounded-lg px-4 py-3 flex items-start gap-5 flex-1 min-w-0">
                  <div className="shrink-0">
                    {controlsStack}
                  </div>
                  <div className="flex-1 min-w-0">
                    {slidersStack}
                  </div>
                </div>
                {/* Metronome + Piano */}
                {rightControls}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return bottomStrip;
}
