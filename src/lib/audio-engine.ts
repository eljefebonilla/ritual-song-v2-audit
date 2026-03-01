"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { PitchShifter } from "soundtouchjs";

export interface AudioEngineOpts {
  url: string | null;
  playing: boolean;
  speed: number;
  pitchSemitones: number;
  volume: number;
  loopStart: number | null; // 0-100 percentage
  loopEnd: number | null; // 0-100 percentage
  onReady: () => void;
  onError: (msg: string) => void;
  onEnd: () => void;
}

export interface AudioEngineState {
  currentTime: number;
  duration: number;
  percentPlayed: number;
  seek: (pct: number) => void; // 0-100
  scrubPreview: (pct: number) => void; // play a tiny raw snippet at this %
  scrubStop: () => void; // kill any active scrub snippet
  setTempoOverride: (tempo: number) => void;
  clearTempoOverride: () => void;
}

export function useAudioEngine(opts: AudioEngineOpts): AudioEngineState {
  const {
    url,
    playing,
    speed,
    pitchSemitones,
    volume,
    loopStart,
    loopEnd,
    onReady,
    onError,
    onEnd,
  } = opts;

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const shifterRef = useRef<PitchShifter | null>(null);
  const audioBufRef = useRef<AudioBuffer | null>(null);
  const scrubSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrubGainRef = useRef<GainNode | null>(null);
  const lastScrubTime = useRef(0);
  const rafRef = useRef<number>(0);
  const playingRef = useRef(false);
  const connectedRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [percentPlayed, setPercentPlayed] = useState(0);

  // Stable callback refs
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onEndRef = useRef(onEnd);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onEndRef.current = onEnd;

  // Loop refs (read in rAF loop without re-renders)
  const loopStartRef = useRef(loopStart);
  const loopEndRef = useRef(loopEnd);
  loopStartRef.current = loopStart;
  loopEndRef.current = loopEnd;

  // Speed ref for tempo override restoration
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // Ensure AudioContext + GainNode exist
  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      gainRef.current = ctxRef.current.createGain();
      gainRef.current.connect(ctxRef.current.destination);
    }
    return { ctx: ctxRef.current, gain: gainRef.current! };
  }, []);

  // Cleanup current shifter
  const destroyShifter = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (shifterRef.current) {
      try {
        shifterRef.current.disconnect();
      } catch {
        // already disconnected
      }
      shifterRef.current.off();
      shifterRef.current = null;
    }
    connectedRef.current = false;
  }, []);

  // rAF progress loop (~4 updates/sec)
  const startProgressLoop = useCallback(() => {
    let lastUpdate = 0;
    const tick = (ts: number) => {
      if (!shifterRef.current) return;
      if (ts - lastUpdate > 250) {
        lastUpdate = ts;
        const pct = shifterRef.current.percentagePlayed;
        const dur = shifterRef.current.duration;
        const time = (pct / 100) * dur;

        // A/B loop check
        const ls = loopStartRef.current;
        const le = loopEndRef.current;
        if (ls !== null && le !== null && pct >= le) {
          shifterRef.current.percentagePlayed = ls / 100;
          setPercentPlayed(ls);
          setCurrentTime((ls / 100) * dur);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        setPercentPlayed(pct);
        setCurrentTime(time);
      }
      if (playingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Load audio when URL changes
  useEffect(() => {
    if (!url) {
      destroyShifter();
      audioBufRef.current = null;
      setCurrentTime(0);
      setDuration(0);
      setPercentPlayed(0);
      return;
    }

    const abortCtrl = new AbortController();

    async function load() {
      try {
        const { ctx, gain } = ensureCtx();

        // Resume suspended context (Safari autoplay policy)
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        destroyShifter();

        const resp = await fetch(url!, { signal: abortCtrl.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();

        if (abortCtrl.signal.aborted) return;

        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        audioBufRef.current = audioBuf;

        if (abortCtrl.signal.aborted) return;

        const shifter = new PitchShifter(ctx, audioBuf, 8192, () => {
          // onEnd callback from SoundTouchJS
          playingRef.current = false;
          connectedRef.current = false;
          cancelAnimationFrame(rafRef.current);
          setPercentPlayed(0);
          setCurrentTime(0);
          onEndRef.current();
        });

        shifter.tempo = speed;
        shifter.pitchSemitones = pitchSemitones;

        shifterRef.current = shifter;
        setDuration(audioBuf.duration);
        setCurrentTime(0);
        setPercentPlayed(0);

        // Auto-connect if playing was requested
        shifter.connect(gain);
        connectedRef.current = true;
        playingRef.current = true;
        startProgressLoop();

        onReadyRef.current();
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        onErrorRef.current(
          err instanceof Error ? err.message : "Failed to load audio"
        );
      }
    }

    load();

    return () => {
      abortCtrl.abort();
      destroyShifter();
    };
    // Only reload when URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Play/Pause
  useEffect(() => {
    const shifter = shifterRef.current;
    const gain = gainRef.current;
    if (!shifter || !gain) return;

    const ctx = ctxRef.current;
    if (ctx?.state === "suspended") {
      ctx.resume();
    }

    if (playing && !connectedRef.current) {
      shifter.connect(gain);
      connectedRef.current = true;
      playingRef.current = true;
      startProgressLoop();
    } else if (!playing && connectedRef.current) {
      shifter.disconnect();
      connectedRef.current = false;
      playingRef.current = false;
      cancelAnimationFrame(rafRef.current);
    }
  }, [playing, startProgressLoop]);

  // Sync tempo
  useEffect(() => {
    if (shifterRef.current) {
      shifterRef.current.tempo = speed;
    }
  }, [speed]);

  // Sync pitch
  useEffect(() => {
    if (shifterRef.current) {
      shifterRef.current.pitchSemitones = pitchSemitones;
    }
  }, [pitchSemitones]);

  // Sync volume
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  // Seek
  const seek = useCallback((pct: number) => {
    if (!shifterRef.current) return;
    const clamped = Math.max(0, Math.min(100, pct));
    shifterRef.current.percentagePlayed = clamped / 100;
    const dur = shifterRef.current.duration;
    setPercentPlayed(clamped);
    setCurrentTime((clamped / 100) * dur);
  }, []);

  // Play a short raw snippet at a given percentage (bypasses PitchShifter).
  // Each snippet gets a fade-in/out envelope to eliminate clicks at edges.
  const scrubPreview = useCallback((pct: number) => {
    const ctx = ctxRef.current;
    const buf = audioBufRef.current;
    if (!ctx || !buf) return;

    // Throttle: skip if less than 50ms since last snippet
    const now = performance.now();
    if (now - lastScrubTime.current < 50) return;
    lastScrubTime.current = now;

    if (ctx.state === "suspended") ctx.resume();

    // Fade out previous snippet (don't hard-stop — that clicks too)
    if (scrubGainRef.current && scrubSourceRef.current) {
      const oldGain = scrubGainRef.current;
      const oldSource = scrubSourceRef.current;
      oldGain.gain.cancelScheduledValues(ctx.currentTime);
      oldGain.gain.setValueAtTime(oldGain.gain.value, ctx.currentTime);
      oldGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.015);
      setTimeout(() => {
        try { oldSource.stop(); } catch { /* already stopped */ }
        oldSource.disconnect();
        oldGain.disconnect();
      }, 20);
    }

    // Each snippet gets its own gain node for independent envelope
    const snippetGain = ctx.createGain();
    snippetGain.connect(ctx.destination);

    const vol = gainRef.current?.gain.value ?? 1;
    const fadeIn = 0.008; // 8ms
    const fadeOut = 0.025; // 25ms
    const sliceDur = 0.15; // 150ms total

    // Envelope: silent → vol (fade in) → vol (sustain) → silent (fade out)
    snippetGain.gain.setValueAtTime(0, ctx.currentTime);
    snippetGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + fadeIn);
    snippetGain.gain.setValueAtTime(vol, ctx.currentTime + sliceDur - fadeOut);
    snippetGain.gain.linearRampToValueAtTime(0, ctx.currentTime + sliceDur);

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(snippetGain);

    const startSec = Math.max(0, (pct / 100) * buf.duration);
    source.start(0, startSec, sliceDur);
    // Auto-cleanup after snippet finishes
    source.onended = () => {
      source.disconnect();
      snippetGain.disconnect();
    };

    scrubSourceRef.current = source;
    scrubGainRef.current = snippetGain;
  }, []);

  // Fade out and kill any active scrub snippet
  const scrubStop = useCallback(() => {
    const ctx = ctxRef.current;
    if (scrubGainRef.current && scrubSourceRef.current && ctx) {
      const g = scrubGainRef.current;
      const s = scrubSourceRef.current;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
      setTimeout(() => {
        try { s.stop(); } catch { /* already stopped */ }
        s.disconnect();
        g.disconnect();
      }, 40);
    }
    scrubSourceRef.current = null;
    scrubGainRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      destroyShifter();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tempo override for transport controls (FF at 3x)
  const setTempoOverride = useCallback((tempo: number) => {
    if (shifterRef.current) {
      shifterRef.current.tempo = tempo;
    }
  }, []);

  const clearTempoOverride = useCallback(() => {
    if (shifterRef.current) {
      shifterRef.current.tempo = speedRef.current;
    }
  }, []);

  return { currentTime, duration, percentPlayed, seek, scrubPreview, scrubStop, setTempoOverride, clearTempoOverride };
}
