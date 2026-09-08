import React, { createContext, useContext, useState } from "react";

const PrivacyModeContext = createContext<{ isPrivate: boolean; togglePrivacy: () => void } | null>(null);

export function PrivacyModeProvider({ children, initialPrivate = false }: { children: React.ReactNode; initialPrivate?: boolean }) {
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  return <PrivacyModeContext.Provider value={{ isPrivate, togglePrivacy: () => setIsPrivate(value => !value) }}>{children}</PrivacyModeContext.Provider>;
}

export function usePrivacyMode() {
  const context = useContext(PrivacyModeContext);
  if (!context) throw new Error("يجب استخدام وضع الخصوصية داخل PrivacyModeProvider.");
  return context;
}
