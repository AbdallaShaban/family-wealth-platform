import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { canChangePlatformRole, canReviewPlatformAdminInvitation, claimInitialPlatformOwner, isEligibleInitialPlatformOwner, isEligiblePlatformAdminInvitation, reviewPlatformAdminInvitation, verifyPlatformAdminInvitationAfterGoogleLogin, type InitialOwnerClaimStore, type PlatformAdminInvitationState } from "./platformOwnership";

type LocalSqlite = {
  exec: (sql: string) => void;
  prepare: (sql: string) => { run: (...parameters: unknown[]) => void; get: () => unknown };
  close: () => void;
};

async function createLocalSqlite() {
  const loadBuiltin = createRequire(import.meta.url);
  const builtin = loadBuiltin("node:sqlite") as { DatabaseSync: new (filename: string) => LocalSqlite };
  return new builtin.DatabaseSync(":memory:");
}

async function createSqliteOwnershipStore(): Promise<InitialOwnerClaimStore & { close: () => void }> {
  const db = await createLocalSqlite();
  db.exec("CREATE TABLE platform_ownership (id INTEGER PRIMARY KEY CHECK (id = 1), ownerUserId INTEGER NOT NULL)");
  return {
    async claimIfEmpty(userId: number) {
      await Promise.resolve();
      db.prepare("INSERT OR IGNORE INTO platform_ownership (id, ownerUserId) VALUES (1, ?)").run(userId);
      const row = db.prepare("SELECT ownerUserId FROM platform_ownership WHERE id = 1").get() as { ownerUserId: number } | undefined;
      return row?.ownerUserId ?? null;
    },
    close: () => db.close(),
  };
}

describe("platform ownership policy", () => {
  it("allows only a Google-authenticated Gmail identity to claim the initial owner record", () => {
    expect(isEligibleInitialPlatformOwner({ email: "Owner@Gmail.com ", loginMethod: "google" })).toBe(true);
    expect(isEligibleInitialPlatformOwner({ email: "owner@example.com", loginMethod: "google" })).toBe(false);
    expect(isEligibleInitialPlatformOwner({ email: "owner@gmail.com", loginMethod: "email" })).toBe(false);
  });

  it("prevents downgrading the platform owner or the final administrator", () => {
    expect(canChangePlatformRole({ actorUserId: 1, targetUserId: 1, ownerUserId: 1, currentRole: "admin", requestedRole: "user", activeAdminCount: 2 })).toMatchObject({ allowed: false });
    expect(canChangePlatformRole({ actorUserId: 2, targetUserId: 3, ownerUserId: 1, currentRole: "admin", requestedRole: "user", activeAdminCount: 1 })).toMatchObject({ allowed: false });
    expect(canChangePlatformRole({ actorUserId: 1, targetUserId: 2, ownerUserId: 1, currentRole: "user", requestedRole: "admin", activeAdminCount: 1 })).toEqual({ allowed: true });
  });

  it("requires Google/Gmail verification and a different reviewer before an administrator invitation can be approved", () => {
    expect(isEligiblePlatformAdminInvitation("new-admin@gmail.com")).toBe(true);
    expect(isEligiblePlatformAdminInvitation("new-admin@example.com")).toBe(false);
    expect(canReviewPlatformAdminInvitation({ status: "awaiting_review", verifiedUserId: 2, invitedByUserId: 1, reviewerUserId: 3, expiresAt: 200, now: 100 })).toEqual({ allowed: true });
    expect(canReviewPlatformAdminInvitation({ status: "awaiting_review", verifiedUserId: 1, invitedByUserId: 2, reviewerUserId: 1, expiresAt: 200, now: 100 })).toMatchObject({ allowed: false });
    expect(canReviewPlatformAdminInvitation({ status: "awaiting_review", verifiedUserId: 2, invitedByUserId: 1, reviewerUserId: 1, expiresAt: 200, now: 100 })).toMatchObject({ allowed: false });
    expect(canReviewPlatformAdminInvitation({ status: "pending_login", verifiedUserId: null, invitedByUserId: 1, reviewerUserId: 2, expiresAt: 200, now: 100 })).toMatchObject({ allowed: false });
  });

  it("keeps exactly one owner when two eligible OAuth bootstraps race in an isolated store", async () => {
    const store = await createSqliteOwnershipStore();
    const [first, second] = await Promise.all([
      claimInitialPlatformOwner({ userId: 11, email: "first@gmail.com", loginMethod: "google", store }),
      claimInitialPlatformOwner({ userId: 12, email: "second@gmail.com", loginMethod: "google", store }),
    ]);
    expect([first.ownerUserId, second.ownerUserId]).toEqual([11, 11]);
    expect([first.claimed, second.claimed]).toEqual([true, false]);
    store.close();
  });

  it("runs the full invitation lifecycle in an isolated SQL database without bypassing the independent review", async () => {
    const db = await createLocalSqlite();
    db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, role TEXT NOT NULL); CREATE TABLE invitations (id INTEGER PRIMARY KEY, email TEXT NOT NULL, invitedByUserId INTEGER NOT NULL, verifiedUserId INTEGER, status TEXT NOT NULL, reviewedByUserId INTEGER)");
    db.prepare("INSERT INTO users (id, role) VALUES (?, ?), (?, ?), (?, ?)").run(1, "admin", 2, "user", 3, "admin");
    db.prepare("INSERT INTO invitations (id, email, invitedByUserId, status) VALUES (?, ?, ?, ?)").run(17, "invitee@gmail.com", 1, "pending_login");
    const invitation: PlatformAdminInvitationState = { id: 17, email: "invitee@gmail.com", invitedByUserId: 1, verifiedUserId: null, status: "pending_login", expiresAt: 2_000 };
    const verification = verifyPlatformAdminInvitationAfterGoogleLogin({ invitation, userId: 2, email: "invitee@gmail.com", loginMethod: "google", now: 1_000 });
    expect(verification).toMatchObject({ verified: true, status: "awaiting_review", verifiedUserId: 2 });
    if (verification.verified) db.prepare("UPDATE invitations SET status = ?, verifiedUserId = ? WHERE id = ?").run(verification.status, verification.verifiedUserId, invitation.id);
    const awaitingReview = { ...invitation, status: "awaiting_review" as const, verifiedUserId: 2 };
    expect(reviewPlatformAdminInvitation({ invitation: awaitingReview, reviewerUserId: 1, decision: "approved", now: 1_100 })).toMatchObject({ allowed: false });
    expect(reviewPlatformAdminInvitation({ invitation: awaitingReview, reviewerUserId: 2, decision: "approved", now: 1_100 })).toMatchObject({ allowed: false });
    const approved = reviewPlatformAdminInvitation({ invitation: awaitingReview, reviewerUserId: 3, decision: "approved", now: 1_100 });
    expect(approved).toEqual({ allowed: true, status: "approved", shouldPromote: true });
    if (approved.allowed && approved.shouldPromote) {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(2);
      db.prepare("UPDATE invitations SET status = ?, reviewedByUserId = ? WHERE id = ?").run(approved.status, 3, invitation.id);
    }
    expect(db.prepare("SELECT role FROM users WHERE id = 2").get()).toEqual({ role: "admin" });
    expect(db.prepare("SELECT status, reviewedByUserId FROM invitations WHERE id = 17").get()).toEqual({ status: "approved", reviewedByUserId: 3 });
    db.close();
  });
});
