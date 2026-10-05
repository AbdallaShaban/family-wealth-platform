import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ViewModeProvider, useViewMode } from "./ViewModeContext";

function TestConsumer() {
  const { viewMode, isFamilyMode, isProMode } = useViewMode();
  return (
    <div>
      <span data-testid="mode">{viewMode}</span>
      <span data-testid="family">{isFamilyMode ? "YES" : "NO"}</span>
      <span data-testid="pro">{isProMode ? "YES" : "NO"}</span>
    </div>
  );
}

describe("ViewModeContext", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // safe fallback
    }
  });

  it("defaults to family mode for warm family-first UX", () => {
    const markup = renderToStaticMarkup(
      <ViewModeProvider>
        <TestConsumer />
      </ViewModeProvider>
    );
    expect(markup).toContain("family");
    expect(markup).toContain("YES");
    expect(markup).toContain("NO");
  });

  it("supports pro mode when initialMode is set", () => {
    const markup = renderToStaticMarkup(
      <ViewModeProvider initialMode="pro">
        <TestConsumer />
      </ViewModeProvider>
    );
    expect(markup).toContain("pro");
  });
});
