"use client";

import { useSyncExternalStore, useCallback } from "react";
import { useUser } from "@/lib/user-context";
import { LS_VIEW_MODE } from "@/lib/storage-keys";

const STORAGE_KEY = LS_VIEW_MODE;
type ViewMode = "director" | "member";

// Module-level listeners for same-tab sync
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): ViewMode {
  return (localStorage.getItem(STORAGE_KEY) as ViewMode) || "director";
}
function getServerSnapshot(): ViewMode {
  return "director";
}
function notify() {
  listeners.forEach((cb) => cb());
}

export function useViewMode() {
  const { isAdmin } = useUser();

  const viewMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setViewMode = useCallback((mode: ViewMode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    notify();
  }, []);

  const toggleViewMode = useCallback(() => {
    const current = getSnapshot();
    setViewMode(current === "director" ? "member" : "director");
  }, [setViewMode]);

  const effectiveIsAdmin = isAdmin && viewMode === "director";

  return { viewMode, setViewMode, toggleViewMode, effectiveIsAdmin, isRealAdmin: isAdmin };
}
