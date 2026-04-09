"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

interface ViewerModeContextValue {
  isViewer: boolean;
}

const ViewerModeContext = createContext<ViewerModeContextValue>({
  isViewer: false,
});

export function ViewerModeProvider({
  isViewer = false,
  children,
}: {
  isViewer?: boolean;
  children: ReactNode;
}) {
  const value = useMemo<ViewerModeContextValue>(
    () => ({ isViewer: Boolean(isViewer) }),
    [isViewer],
  );
  return <ViewerModeContext.Provider value={value}>{children}</ViewerModeContext.Provider>;
}

export function useViewerMode(): ViewerModeContextValue {
  return useContext(ViewerModeContext);
}
