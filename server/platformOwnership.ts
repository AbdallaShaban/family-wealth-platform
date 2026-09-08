export type PlatformOwnerCandidate = {
  email: string | null | undefined;
  loginMethod: string | null | undefined;
};

export type InitialOwnerClaimStore = {
  claimIfEmpty: (userId: number) => Promise<number | null>;
};

/** Only a verified Google sign-in with a personal Gmail address can claim the initial platform owner record. */
export function isEligibleInitialPlatformOwner(candidate: PlatformOwnerCandidate) {
  const email = candidate.email?.trim().toLowerCase() ?? "";
  const loginMethod = candidate.loginMethod?.trim().toLowerCase() ?? "";
  return loginMethod === "google" && email.endsWith("@gmail.com");
}

/**
 * Coordinates the policy decision with an atomic persistence primitive.
 * Production supplies an INSERT IGNORE-backed store; tests use an isolated
 * in-memory store to exercise concurrent OAuth bootstrap attempts.
 */
export async function claimInitialPlatformOwner(args: PlatformOwnerCandidate & { userId: number; store: InitialOwnerClaimStore }) {
  if (!isEligibleInitialPlatformOwner(args)) return { eligible: false as const, ownerUserId: null, claimed: false as const };
  const ownerUserId = await args.store.claimIfEmpty(args.userId);
  return { eligible: true as const, ownerUserId, claimed: ownerUserId === args.userId };
}

export const PLATFORM_ADMIN_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isEligiblePlatformAdminInvitation(email: string) {
  return email.trim().toLowerCase().endsWith("@gmail.com");
}

export function canReviewPlatformAdminInvitation(args: {
  status: "pending_login" | "awaiting_review" | "approved" | "rejected" | "cancelled" | "expired";
  verifiedUserId: number | null;
  invitedByUserId: number;
  reviewerUserId: number;
  expiresAt: number;
  now: number;
}) {
  if (args.status !== "awaiting_review" || !args.verifiedUserId) return { allowed: false as const, reason: "الدعوة لم تصل بعد إلى مرحلة المراجعة." };
  if (args.expiresAt <= args.now) return { allowed: false as const, reason: "انتهت صلاحية الدعوة قبل المراجعة." };
  if (args.verifiedUserId === args.reviewerUserId) return { allowed: false as const, reason: "لا يمكن لصاحب الدعوة اعتماد ترقيته بنفسه." };
  if (args.invitedByUserId === args.reviewerUserId) return { allowed: false as const, reason: "يلزم مدير عام ثانٍ مستقل عن منشئ الدعوة لاعتماد الترقية." };
  return { allowed: true as const };
}

export type PlatformAdminInvitationState = {
  id: number;
  email: string;
  invitedByUserId: number;
  verifiedUserId: number | null;
  status: "pending_login" | "awaiting_review" | "approved" | "rejected" | "cancelled" | "expired";
  expiresAt: number;
};

export function verifyPlatformAdminInvitationAfterGoogleLogin(args: {
  invitation: PlatformAdminInvitationState;
  userId: number;
  email: string | null | undefined;
  loginMethod: string | null | undefined;
  now: number;
}) {
  const sameEmail = args.email?.trim().toLowerCase() === args.invitation.email.trim().toLowerCase();
  if (!sameEmail || !isEligibleInitialPlatformOwner({ email: args.email, loginMethod: args.loginMethod })) return { verified: false as const };
  if (args.invitation.status !== "pending_login" || args.invitation.expiresAt <= args.now) return { verified: false as const };
  return { verified: true as const, status: "awaiting_review" as const, verifiedUserId: args.userId };
}

export function reviewPlatformAdminInvitation(args: {
  invitation: PlatformAdminInvitationState;
  reviewerUserId: number;
  decision: "approved" | "rejected";
  now: number;
}) {
  const review = canReviewPlatformAdminInvitation({ status: args.invitation.status, verifiedUserId: args.invitation.verifiedUserId, invitedByUserId: args.invitation.invitedByUserId, reviewerUserId: args.reviewerUserId, expiresAt: args.invitation.expiresAt, now: args.now });
  if (!review.allowed) return { allowed: false as const, reason: review.reason };
  return { allowed: true as const, status: args.decision, shouldPromote: args.decision === "approved" };
}

export function canChangePlatformRole(args: {
  actorUserId: number;
  targetUserId: number;
  ownerUserId: number;
  currentRole: "user" | "admin";
  requestedRole: "user" | "admin";
  activeAdminCount: number;
}) {
  if (args.targetUserId === args.ownerUserId && args.requestedRole !== "admin") {
    return { allowed: false as const, reason: "لا يمكن خفض صلاحية المالك الرئيس للمنصة." };
  }
  if (args.actorUserId === args.targetUserId && args.requestedRole !== "admin") {
    return { allowed: false as const, reason: "لا يمكنك خفض صلاحية حسابك أثناء الجلسة الحالية." };
  }
  if (args.currentRole === "admin" && args.requestedRole !== "admin" && args.activeAdminCount <= 1) {
    return { allowed: false as const, reason: "يجب أن يبقى مدير عام واحد نشط على الأقل." };
  }
  return { allowed: true as const };
}
