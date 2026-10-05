import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ViewMode = "family" | "pro";

const STORAGE_KEY = "family_view_mode";

interface ViewModeContextType {
  viewMode: ViewMode;
  isFamilyMode: boolean;
  isProMode: boolean;
  toggleViewMode: () => void;
  setViewMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextType | null>(null);

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "family";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "pro" || saved === "family") {
      return saved;
    }
  } catch {
    // Storage access might be restricted
  }
  return "family"; // Default to family mode for warm, human-friendly UX
}

export function ViewModeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode?: ViewMode;
}) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() =>
    initialMode || getInitialViewMode()
  );

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, mode);
      }
    } catch {
      // Storage access might be restricted
    }
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewModeState((prev) => {
      const next: ViewMode = prev === "family" ? "pro" : "family";
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, next);
        }
      } catch {
        // Storage access might be restricted
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      viewMode,
      isFamilyMode: viewMode === "family",
      isProMode: viewMode === "pro",
      toggleViewMode,
      setViewMode,
    }),
    [viewMode, toggleViewMode, setViewMode]
  );

  return (
    <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}
