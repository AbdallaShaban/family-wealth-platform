import { describe, expect, it } from "vitest";
import { assertRole, type FamilyContext, type WorkspaceRole } from "./familyAccess";

function contextWith(role: WorkspaceRole) {
  return { membership: { role } } as unknown as FamilyContext;
}

describe("FAMILY workspace authorization", () => {
  it("allows the owner to perform an editor-level operation", () => {
    expect(() => assertRole(contextWith("owner"), "editor")).not.toThrow();
  });

  it("does not allow a viewer to perform an editor-level operation", () => {
    expect(() => assertRole(contextWith("viewer"), "editor")).toThrow("لا تملك الصلاحية المطلوبة");
  });

  it("does not allow an editor to perform an advisor-level operation", () => {
    expect(() => assertRole(contextWith("editor"), "advisor")).toThrow("لا تملك الصلاحية المطلوبة");
  });
});
