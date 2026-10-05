import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

type DemoModeContextValue = {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
};

const DemoModeContext = createContext<DemoModeContextValue | undefined>(undefined);
const STORAGE_KEY = "family-demo-mode";

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, "false");
    } catch {
      // ignore storage access errors
    }
  }, []);

  const toggleDemoMode = useCallback(() => {
    // Platform is permanently operating in real live production mode
  }, []);

  const value = useMemo(
    () => ({ isDemoMode: false, toggleDemoMode }),
    [toggleDemoMode]
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) throw new Error("useDemoMode must be used within DemoModeProvider");
  return context;
}
