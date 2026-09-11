import { usePrivacyMode } from "@/contexts/PrivacyModeContext";
import { PRIVATE_VALUE_PLACEHOLDER } from "@/lib/financialDisplay";
import React from "react";

export default function SensitiveValue({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { isPrivate } = usePrivacyMode();
  return (
    <span
      className={`financial-num ${className}`.trim()}
      dir="ltr"
      data-sensitive-value
      aria-label={isPrivate ? "قيمة مخفية في وضع الخصوصية" : undefined}
    >
      {isPrivate ? PRIVATE_VALUE_PLACEHOLDER : children}
    </span>
  );
}
