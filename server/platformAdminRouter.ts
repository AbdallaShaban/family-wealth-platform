import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNotNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { platformAdminInvitations, platformAuditEvents, platformOwnership, users } from "../drizzle/schema";
import { getDb } from "./db";
import { adminProcedure, router } from "./_core/trpc";
import { canChangePlatformRole, isEligiblePlatformAdminInvitation, PLATFORM_ADMIN_INVITATION_TTL_MS, reviewPlatformAdminInvitation } from "./platformOwnership";
import { getSmtpConfiguration, sendAdminInvitationEmail, verifySmtpConnection } from "./mailer";

const INVITATION_RESEND_COOLDOWN_MS = 60_000;

function notAvailable() {
  return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة بيانات FAMILY غير متاحة حاليًا." });
}

export const platformAdminRouter = router({
  ownership: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw notAvailable();
    const [owner] = await db.select({ id: users.id, name: users.name, email: users.email, loginMethod: users.loginMethod, role: users.role, claimedAt: platformOwnership.createdAt }).from(platformOwnership).innerJoin(users, eq(platformOwnership.ownerUserId, users.id)).where(eq(platformOwnership.id, 1)).limit(1);
    if (!owner) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لم يُثبت مالك المنصة بعد؛ يلزم أول تسجيل Google/Gmail موثق." });
    return owner;
  }),

  users: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw notAvailable();
    return db.select({ id: users.id, name: users.name, email: users.email, loginMethod: users.loginMethod, role: users.role, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(and(isNotNull(users.email), ne(users.email, ""))).orderBy(desc(users.lastSignedIn), users.id);
  }),

  recentAudit: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw notAvailable();
    return db.select({ id: platformAuditEvents.id, action: platformAuditEvents.action, beforeState: platformAuditEvents.beforeState, afterState: platformAuditEvents.afterState, occurredAt: platformAuditEvents.occurredAt, actorName: users.name, actorEmail: users.email }).from(platformAuditEvents).innerJoin(users, eq(platformAuditEvents.actorUserId, users.id)).orderBy(desc(platformAuditEvents.occurredAt)).limit(30);
  }),

  invitations: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw notAvailable();
    const now = Date.now();
    await db.update(platformAdminInvitations).set({ status: "expired", updatedAt: now }).where(and(or(eq(platformAdminInvitations.status, "pending_login"), eq(platformAdminInvitations.status, "awaiting_review")), sql`${platformAdminInvitations.expiresAt} <= ${now}`));
    return db.select().from(platformAdminInvitations).orderBy(desc(platformAdminInvitations.createdAt)).limit(30);
  }),

  smtpStatus: adminProcedure.query(() => {
    const result = getSmtpConfiguration();
    return result.configured ? { configured: true as const, secure: result.config.secure, port: result.config.port } : { configured: false as const, reason: result.reason };
  }),

  verifySmtp: adminProcedure.mutation(async ({ ctx }) => {
    const result = await verifySmtpConnection();
    const db = await getDb();
    if (db) {
      await db.insert(platformAuditEvents).values({
        actorUserId: ctx.user.id,
        action: `platform_smtp.verification_${result.status}`,
        beforeState: null,
        afterState: { delivered: result.delivered, status: result.status },
        occurredAt: Date.now(),
      });
    }
    return result;
  }),

  createInvitation: adminProcedure.input(z.object({ email: z.string().trim().email().max(320), origin: z.string().url().max(2_048) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw notAvailable();
    const email = input.email.toLowerCase();
    if (!isEligiblePlatformAdminInvitation(email)) throw new TRPCError({ code: "BAD_REQUEST", message: "دعوة المدير العام متاحة لحساب Gmail فقط، ويجب أن يتحقق عبر تسجيل Google." });
    const [openInvite] = await db.select({ id: platformAdminInvitations.id }).from(platformAdminInvitations).where(and(eq(platformAdminInvitations.email, email), or(eq(platformAdminInvitations.status, "pending_login"), eq(platformAdminInvitations.status, "awaiting_review")))).limit(1);
    if (openInvite) throw new TRPCError({ code: "CONFLICT", message: "توجد دعوة مدير عام مفتوحة لهذا البريد بالفعل." });
    const [existingUser] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser?.role === "admin") throw new TRPCError({ code: "CONFLICT", message: "هذا الحساب يحمل بالفعل دور مدير عام." });
    const now = Date.now();
    const expiresAt = now + PLATFORM_ADMIN_INVITATION_TTL_MS;
    const invitationResult = await db.transaction(async tx => {
      const result = await tx.insert(platformAdminInvitations).values({ email, invitedByUserId: ctx.user.id, status: "pending_login", expiresAt, createdAt: now, updatedAt: now });
      await tx.insert(platformAuditEvents).values({ actorUserId: ctx.user.id, action: "platform_admin_invitation.created", beforeState: null, afterState: { email, status: "pending_login", expiresAt }, occurredAt: now });
      return result;
    });
    const invitationId = Number(invitationResult[0].insertId);
    const delivery = await sendAdminInvitationEmail({ recipient: email, origin: input.origin, expiresAt });
    const deliveryAt = Date.now();
    await db.transaction(async tx => {
      await tx.update(platformAdminInvitations).set({ emailDeliveryStatus: delivery.status, lastEmailAttemptAt: deliveryAt, lastEmailSentAt: delivery.delivered ? deliveryAt : null, updatedAt: deliveryAt }).where(eq(platformAdminInvitations.id, invitationId));
      await tx.insert(platformAuditEvents).values({ actorUserId: ctx.user.id, action: `platform_admin_invitation.email_${delivery.status}`, beforeState: null, afterState: { invitationId, delivered: delivery.delivered, status: delivery.status }, occurredAt: deliveryAt });
    });
    return { id: invitationId, email, status: "pending_login" as const, expiresAt, delivery };
  }),

  resendInvitationEmail: adminProcedure.input(z.object({ invitationId: z.number().int().positive(), origin: z.string().url().max(2_048) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw notAvailable();
    const [invitation] = await db.select().from(platformAdminInvitations).where(eq(platformAdminInvitations.id, input.invitationId)).limit(1);
    if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "دعوة المدير العام غير موجودة." });
    const now = Date.now();
    if (!['pending_login', 'awaiting_review'].includes(invitation.status) || invitation.expiresAt <= now) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إعادة إرسال دعوة منتهية أو مغلقة." });
    if (invitation.lastEmailAttemptAt && now - invitation.lastEmailAttemptAt < INVITATION_RESEND_COOLDOWN_MS) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "انتظر دقيقة واحدة قبل إعادة إرسال الدعوة." });
    const delivery = await sendAdminInvitationEmail({ recipient: invitation.email, origin: input.origin, expiresAt: invitation.expiresAt });
    await db.transaction(async tx => {
      await tx.update(platformAdminInvitations).set({ emailDeliveryStatus: delivery.status, lastEmailAttemptAt: now, lastEmailSentAt: delivery.delivered ? now : invitation.lastEmailSentAt, updatedAt: now }).where(eq(platformAdminInvitations.id, invitation.id));
      await tx.insert(platformAuditEvents).values({ actorUserId: ctx.user.id, action: `platform_admin_invitation.email_${delivery.status}`, beforeState: null, afterState: { invitationId: invitation.id, delivered: delivery.delivered, status: delivery.status, resent: true }, occurredAt: now });
    });
    return { id: invitation.id, delivery };
  }),

  reviewInvitation: adminProcedure.input(z.object({ invitationId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw notAvailable();
    const [invitation] = await db.select().from(platformAdminInvitations).where(eq(platformAdminInvitations.id, input.invitationId)).limit(1);
    if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "دعوة المدير العام غير موجودة." });
    const now = Date.now();
    const review = reviewPlatformAdminInvitation({ invitation, reviewerUserId: ctx.user.id, decision: input.decision, now });
    if (!review.allowed) throw new TRPCError({ code: "FORBIDDEN", message: review.reason });
    await db.transaction(async tx => {
      if (review.shouldPromote && invitation.verifiedUserId) await tx.update(users).set({ role: "admin" }).where(eq(users.id, invitation.verifiedUserId));
      await tx.update(platformAdminInvitations).set({ status: review.status, reviewedByUserId: ctx.user.id, updatedAt: now }).where(eq(platformAdminInvitations.id, invitation.id));
      await tx.insert(platformAuditEvents).values({ actorUserId: ctx.user.id, targetUserId: invitation.verifiedUserId, action: `platform_admin_invitation.${review.status}`, beforeState: { status: invitation.status }, afterState: { status: review.status, invitationId: invitation.id }, occurredAt: now });
    });
    return { id: invitation.id, status: review.status };
  }),

  cancelInvitation: adminProcedure.input(z.object({ invitationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw notAvailable();
    const [invitation] = await db.select().from(platformAdminInvitations).where(eq(platformAdminInvitations.id, input.invitationId)).limit(1);
    if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "دعوة المدير العام غير موجودة." });
    if (!["pending_login", "awaiting_review"].includes(invitation.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إلغاء دعوة أغلقت أو روجعت بالفعل." });
    const now = Date.now();
    await db.transaction(async tx => {
      await tx.update(platformAdminInvitations).set({ status: "cancelled", reviewedByUserId: ctx.user.id, updatedAt: now }).where(eq(platformAdminInvitations.id, invitation.id));
      await tx.insert(platformAuditEvents).values({ actorUserId: ctx.user.id, targetUserId: invitation.verifiedUserId, action: "platform_admin_invitation.cancelled", beforeState: { status: invitation.status }, afterState: { status: "cancelled", invitationId: invitation.id }, occurredAt: now });
    });
    return { id: invitation.id, status: "cancelled" as const };
  }),

  setUserRole: adminProcedure.input(z.object({ targetUserId: z.number().int().positive(), role: z.enum(["user", "admin"]) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw notAvailable();
    if (input.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "ترقية مدير عام جديدة تتطلب دعوة Google/Gmail ومراجعة مدير عام ثانٍ." });
    const [ownership] = await db.select().from(platformOwnership).where(eq(platformOwnership.id, 1)).limit(1);
    if (!ownership) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن إدارة أدوار المنصة قبل تثبيت المالك الرئيس." });
    const [target] = await db.select().from(users).where(eq(users.id, input.targetUserId)).limit(1);
    if (!target || !target.email) throw new TRPCError({ code: "NOT_FOUND", message: "حساب مستخدم موثق غير موجود." });
    const administrators = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    const decision = canChangePlatformRole({ actorUserId: ctx.user.id, targetUserId: target.id, ownerUserId: ownership.ownerUserId, currentRole: target.role, requestedRole: input.role, activeAdminCount: administrators.length });
    if (!decision.allowed) throw new TRPCError({ code: "FORBIDDEN", message: decision.reason });
    if (target.role === input.role) return { id: target.id, role: target.role, changed: false as const };
    const now = Date.now();
    await db.transaction(async tx => {
      await tx.update(users).set({ role: input.role }).where(eq(users.id, target.id));
      await tx.insert(platformAuditEvents).values({ actorUserId: ctx.user.id, targetUserId: target.id, action: "platform_user.role_changed", beforeState: { role: target.role }, afterState: { role: input.role }, occurredAt: now });
    });
    return { id: target.id, role: input.role, changed: true as const };
  }),
});
