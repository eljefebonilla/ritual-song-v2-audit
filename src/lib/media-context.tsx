"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

export type MediaType = "audio" | "youtube";

export interface MediaItem {
  type: MediaType;
  url: string;
  title: string;
  subtitle?: string;
}

interface MediaContextValue {
  current: MediaItem | null;
  isOpen: boolean;
  play: (item: MediaItem) => void;
  stop: () => void;
  close: () => void;
}

const MediaContext = createContext<MediaContextValue>({
  current: null,
  isOpen: false,
  play: () => {},
  stop: () => {},
  close: () => {},
});

export function MediaProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<MediaItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const play = useCallback((item: MediaItem) => {
    setCurrent(item);
    setIsOpen(true);
  }, []);

  const stop = useCallback(() => {
    setCurrent(null);
  }, []);

  const close = useCallback(() => {
    setCurrent(null);
    setIsOpen(false);
  }, []);

  return (
    <MediaContext.Provider value={{ current, isOpen, play, stop, close }}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  return useContext(MediaContext);
}
