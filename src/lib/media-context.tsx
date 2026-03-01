"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import type { ReactNode } from "react";

export type MediaType = "audio" | "youtube";

export interface MediaItem {
  type: MediaType;
  url: string;
  title: string;
  subtitle?: string;
  songId?: string;
  recordedKey?: string;
  chartKeys?: string[];
}

interface MediaContextValue {
  current: MediaItem | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  speed: number;
  pitchSemitones: number;
  volume: number;
  play: (item: MediaItem) => void;
  updateCurrent: (partial: Partial<MediaItem>) => void;
  stop: () => void;
  close: () => void;
  setSpeed: (s: number) => void;
  setPitchSemitones: (p: number) => void;
  setVolume: (v: number) => void;
  setIsLoading: (l: boolean) => void;
  setError: (e: string | null) => void;
}

const LS_SPEED = "rs-player-speed";
const LS_PITCH = "rs-player-pitch";
const LS_VOLUME = "rs-player-volume";

function readLS(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  const n = parseFloat(v);
  return isFinite(n) ? n : fallback;
}

const MediaContext = createContext<MediaContextValue>({
  current: null,
  isOpen: false,
  isLoading: false,
  error: null,
  speed: 1,
  pitchSemitones: 0,
  volume: 1,
  play: () => {},
  updateCurrent: () => {},
  stop: () => {},
  close: () => {},
  setSpeed: () => {},
  setPitchSemitones: () => {},
  setVolume: () => {},
  setIsLoading: () => {},
  setError: () => {},
});

export function MediaProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<MediaItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [speed, setSpeedRaw] = useState(1);
  const [pitchSemitones, setPitchRaw] = useState(0);
  const [volume, setVolumeRaw] = useState(1);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setSpeedRaw(readLS(LS_SPEED, 1));
    setPitchRaw(readLS(LS_PITCH, 0));
    setVolumeRaw(readLS(LS_VOLUME, 1));
  }, []);

  const setSpeed = useCallback((s: number) => {
    const clamped = Math.max(0.6, Math.min(1, s));
    setSpeedRaw(clamped);
    localStorage.setItem(LS_SPEED, String(clamped));
  }, []);

  const setPitchSemitones = useCallback((p: number) => {
    const clamped = Math.max(-12, Math.min(12, Math.round(p)));
    setPitchRaw(clamped);
    localStorage.setItem(LS_PITCH, String(clamped));
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeRaw(clamped);
    localStorage.setItem(LS_VOLUME, String(clamped));
  }, []);

  const play = useCallback((item: MediaItem) => {
    setCurrent(item);
    setIsOpen(true);
    setError(null);
    setPitchRaw(0);
    localStorage.setItem(LS_PITCH, "0");
    if (item.type === "audio") {
      setIsLoading(true);
    }
  }, []);

  const updateCurrent = useCallback((partial: Partial<MediaItem>) => {
    setCurrent((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const stop = useCallback(() => {
    setCurrent(null);
    setIsLoading(false);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setCurrent(null);
    setIsOpen(false);
    setIsLoading(false);
    setError(null);
  }, []);

  return (
    <MediaContext.Provider
      value={{
        current,
        isOpen,
        isLoading,
        error,
        speed,
        pitchSemitones,
        volume,
        play,
        updateCurrent,
        stop,
        close,
        setSpeed,
        setPitchSemitones,
        setVolume,
        setIsLoading,
        setError,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  return useContext(MediaContext);
}
