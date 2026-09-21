import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "family_privacy_mode";

interface PrivacyModeContextType {
  isPrivate: boolean;
  togglePrivacy: () => void;
  setPrivacy: (value: boolean) => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextType | null>(null);

function getInitialPrivacyState(fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return saved === "true";
    }
  } catch {
    // Storage access might be restricted; fallback gracefully
  }
  return fallback;
}

export function PrivacyModeProvider({
  children,
  initialPrivate = false,
}: {
  children: React.ReactNode;
  initialPrivate?: boolean;
}) {
  const [isPrivate, setIsPrivateState] = useState<boolean>(() =>
    getInitialPrivacyState(initialPrivate)
  );

  const setPrivacy = useCallback((value: boolean) => {
    setIsPrivateState(value);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, String(value));
      }
    } catch {
      // Storage access might be restricted
    }
  }, []);

  const togglePrivacy = useCallback(() => {
    setIsPrivateState(prev => {
      const next = !prev;
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, String(next));
        }
      } catch {
        // Storage access might be restricted
      }
      return next;
    });
  }, []);

  // Sync class on documentElement or body for global CSS targeting
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (isPrivate) {
        document.documentElement.classList.add("privacy-mode-active");
      } else {
        document.documentElement.classList.remove("privacy-mode-active");
      }
    }
  }, [isPrivate]);

  const value = useMemo(
    () => ({ isPrivate, togglePrivacy, setPrivacy }),
    [isPrivate, togglePrivacy, setPrivacy]
  );

  return (
    <PrivacyModeContext.Provider value={value}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode(): PrivacyModeContextType {
  const context = useContext(PrivacyModeContext);
  if (!context) {
    throw new Error("يجب استخدام وضع الخصوصية داخل PrivacyModeProvider.");
  }
  return context;
}
