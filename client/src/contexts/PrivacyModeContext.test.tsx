import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PrivacyModeProvider, usePrivacyMode } from "./PrivacyModeContext";

function TestConsumer() {
  const { isPrivate } = usePrivacyMode();
  return <div data-testid="privacy-status">{isPrivate ? "PRIVATE" : "PUBLIC"}</div>;
}

describe("PrivacyModeContext", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // safe fallback
    }
  });

  it("renders with initial private false by default", () => {
    const markup = renderToStaticMarkup(
      <PrivacyModeProvider>
        <TestConsumer />
      </PrivacyModeProvider>
    );
    expect(markup).toContain("PUBLIC");
  });

  it("renders with initial private true when prop provided", () => {
    const markup = renderToStaticMarkup(
      <PrivacyModeProvider initialPrivate={true}>
        <TestConsumer />
      </PrivacyModeProvider>
    );
    expect(markup).toContain("PRIVATE");
  });
});
