import { and, eq, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import { financialProfiles, memberships, users, workspaceInvitations, workspaces } from "../drizzle/schema";
import { getDb } from "./db";

export type WorkspaceRole = "owner" | "advisor" | "editor" | "viewer";

export type FamilyContext = {
  workspace: typeof workspaces.$inferSelect;
  membership: typeof memberships.$inferSelect;
  profile: typeof financialProfiles.$inferSelect;
};

const roleRank: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  advisor: 3,
  owner: 4,
};

function dbUnavailable() {
  return new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "قاعدة بيانات FAMILY غير متاحة حاليًا.",
  });
}

/**
 * Every authenticated user receives exactly one personal FAMILY workspace.
 * A unique personalOwnerUserId makes this safe to call repeatedly and avoids
 * accidentally mixing the user's financial records with another member's data.
 */
export async function ensurePersonalFamilyContext(user: User): Promise<FamilyContext> {
  const db = await getDb();
  if (!db) throw dbUnavailable();

  const now = Date.now();
  await db.transaction(async tx => {
    let [workspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.personalOwnerUserId, user.id))
      .orderBy(workspaces.id)
      .limit(1);
    if (!workspace) {
      await tx.insert(workspaces).values({
        name: `FAMILY — ${user.name || "مساحة مالية"}`,
        baseCurrency: "EGP",
        createdByUserId: user.id,
        personalOwnerUserId: user.id,
        createdAt: now,
        updatedAt: now,
      });
      [workspace] = await tx
        .select()
        .from(workspaces)
        .where(eq(workspaces.personalOwnerUserId, user.id))
        .orderBy(workspaces.id)
        .limit(1);
    }
    if (!workspace) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء نطاق FAMILY الشخصي." });

    const [existingMembership] = await tx.select().from(memberships).where(and(eq(memberships.workspaceId, workspace.id), eq(memberships.userId, user.id))).orderBy(memberships.id).limit(1);
    if (!existingMembership) {
      await tx.insert(memberships).values({ workspaceId: workspace.id, userId: user.id, role: "owner", status: "active", createdAt: now, updatedAt: now });
    } else if (existingMembership.role !== "owner" || existingMembership.status !== "active") {
      await tx.update(memberships).set({ role: "owner", status: "active", updatedAt: now }).where(eq(memberships.id, existingMembership.id));
    }

    const [existingProfile] = await tx.select().from(financialProfiles).where(and(eq(financialProfiles.workspaceId, workspace.id), eq(financialProfiles.userId, user.id))).orderBy(financialProfiles.id).limit(1);
    if (!existingProfile) {
      await tx.insert(financialProfiles).values({
        workspaceId: workspace.id,
        userId: user.id,
        displayName: user.name || "المالك المالي",
        relationship: "self",
        isFinancialOwner: "yes",
        createdAt: now,
        updatedAt: now,
      });
    } else if (existingProfile.displayName !== (user.name || "المالك المالي") || existingProfile.isFinancialOwner !== "yes") {
      await tx.update(financialProfiles).set({ displayName: user.name || "المالك المالي", isFinancialOwner: "yes", updatedAt: now }).where(eq(financialProfiles.id, existingProfile.id));
    }

    if (user.email) {
      const invitations = await tx.select().from(workspaceInvitations).where(and(
        eq(workspaceInvitations.email, user.email.trim().toLowerCase()),
        eq(workspaceInvitations.status, "pending"),
        gt(workspaceInvitations.expiresAt, now),
      ));
      for (const invitation of invitations) {
        const [invitedMembership] = await tx.select().from(memberships).where(and(eq(memberships.workspaceId, invitation.workspaceId), eq(memberships.userId, user.id))).orderBy(memberships.id).limit(1);
        if (!invitedMembership) await tx.insert(memberships).values({ workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role, status: "active", createdAt: now, updatedAt: now });
        else await tx.update(memberships).set({ role: invitation.role, status: "active", updatedAt: now }).where(eq(memberships.id, invitedMembership.id));
        const [invitedProfile] = await tx.select().from(financialProfiles).where(and(eq(financialProfiles.workspaceId, invitation.workspaceId), eq(financialProfiles.userId, user.id))).orderBy(financialProfiles.id).limit(1);
        if (!invitedProfile) await tx.insert(financialProfiles).values({ workspaceId: invitation.workspaceId, userId: user.id, displayName: user.name || user.email, relationship: invitation.role === "advisor" ? "advisor" : "other", isFinancialOwner: "no", createdAt: now, updatedAt: now });
        else await tx.update(financialProfiles).set({ displayName: user.name || user.email, relationship: invitation.role === "advisor" ? "advisor" : "other", updatedAt: now }).where(eq(financialProfiles.id, invitedProfile.id));
        await tx.update(workspaceInvitations).set({ status: "accepted", acceptedByUserId: user.id, updatedAt: now }).where(eq(workspaceInvitations.id, invitation.id));
      }
    }
  });

  const [activeMembership] = user.activeWorkspaceId ? await db.select().from(memberships).where(and(eq(memberships.workspaceId, user.activeWorkspaceId), eq(memberships.userId, user.id), eq(memberships.status, "active"))).limit(1) : [];
  const [personalWorkspace] = await db.select().from(workspaces).where(eq(workspaces.personalOwnerUserId, user.id)).limit(1);
  const workspaceId = activeMembership?.workspaceId ?? personalWorkspace?.id;
  if (workspaceId && workspaceId !== user.activeWorkspaceId) await db.update(users).set({ activeWorkspaceId: workspaceId }).where(eq(users.id, user.id));
  const [workspace] = workspaceId ? await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1) : [];
  if (!workspace) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تحميل نطاق FAMILY." });

  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspace.id), eq(memberships.userId, user.id), eq(memberships.status, "active")))
    .limit(1);
  const [profile] = await db
    .select()
    .from(financialProfiles)
    .where(and(eq(financialProfiles.workspaceId, workspace.id), eq(financialProfiles.userId, user.id)))
    .limit(1);

  if (!membership || !profile) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك نطاقًا ماليًا فعّالًا." });
  }
  return { workspace, membership, profile };
}

export async function listAccessibleWorkspaces(user: User) {
  await ensurePersonalFamilyContext(user);
  const db = await getDb();
  if (!db) throw dbUnavailable();
  return db.select({ id: workspaces.id, name: workspaces.name, baseCurrency: workspaces.baseCurrency, role: memberships.role, personalOwnerUserId: workspaces.personalOwnerUserId }).from(memberships).innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id)).where(and(eq(memberships.userId, user.id), eq(memberships.status, "active")));
}

export async function setActiveFamilyWorkspace(user: User, workspaceId: number) {
  const db = await getDb();
  if (!db) throw dbUnavailable();
  const [membership] = await db.select().from(memberships).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, user.id), eq(memberships.status, "active"))).limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية فعالة في مساحة FAMILY المطلوبة." });
  await db.update(users).set({ activeWorkspaceId: workspaceId }).where(eq(users.id, user.id));
  return { workspaceId };
}

export function assertRole(context: FamilyContext, minimum: WorkspaceRole) {
  if (roleRank[context.membership.role] < roleRank[minimum]) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك الصلاحية المطلوبة لهذه العملية." });
  }
}
