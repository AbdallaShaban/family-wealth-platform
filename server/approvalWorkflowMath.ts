import Decimal from "decimal.js";

export const approvalActionTypes = ["cash_event", "transfer", "trade", "budget_adjustment", "period_adjustment"] as const;
export type ApprovalActionType = (typeof approvalActionTypes)[number];

export function requiresApproval(amount: string, threshold: string, sameCurrency: boolean) {
  return sameCurrency && new Decimal(amount).gte(new Decimal(threshold));
}

export function canDecideApproval(args: { requesterId: number; approverId: number; roleMatches: boolean; lastSignedInMs: number; nowMs: number; requireSeparateApprover?: boolean; requireReconfirmation?: boolean }) {
  const separateApproverRequired = args.requireSeparateApprover ?? true;
  const reconfirmationRequired = args.requireReconfirmation ?? true;
  const hasSeparateApprover = !separateApproverRequired || args.requesterId !== args.approverId;
  const hasRecentSignIn = !reconfirmationRequired || args.nowMs - args.lastSignedInMs <= 15 * 60 * 1000;
  return args.roleMatches && hasSeparateApprover && hasRecentSignIn;
}

export function isApprovalExecutable(args: { status: string; expiresAt: number | null; nowMs: number }) {
  return args.status === "approved" && (args.expiresAt === null || args.expiresAt > args.nowMs);
}

export function normalizedApprovalAmount(amount: string, quantity?: string, unitPrice?: string) {
  if (quantity !== undefined && unitPrice !== undefined) return new Decimal(quantity).mul(new Decimal(unitPrice)).toFixed(6);
  return new Decimal(amount).toFixed(6);
}
