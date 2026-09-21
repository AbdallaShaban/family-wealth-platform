import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type DemoModeContextValue = {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
};

const DemoModeContext = createContext<DemoModeContextValue | undefined>(undefined);
const STORAGE_KEY = "family-demo-mode";

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(() => new URLSearchParams(window.location.search).get("demo") === "1" || localStorage.getItem(STORAGE_KEY) === "true");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isDemoMode));
  }, [isDemoMode]);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(value => !value);
  }, []);

  const value = useMemo(
    () => ({ isDemoMode, toggleDemoMode }),
    [isDemoMode, toggleDemoMode]
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) throw new Error("useDemoMode must be used within DemoModeProvider");
  return context;
}
