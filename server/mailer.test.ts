import { describe, expect, it, vi } from "vitest";
import { getSmtpConfiguration, isSmtpSendingEnabled, sendAdminInvitationEmail, sendMarketReviewEmail, verifySmtpConnection, type SmtpEnvironment } from "./mailer";

const completeEnvironment: SmtpEnvironment = {
  SMTP_USER: "family.sender@gmail.com",
  SMTP_PASS: "UNIT_TEST_PLACEHOLDER_ONLY",
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "587",
  SMTP_SEND_ENABLED: "yes",
};

describe("Gmail SMTP mailer", () => {
  it("requires all SMTP settings and never echoes a password", () => {
    const result = getSmtpConfiguration({ SMTP_USER: "sender@gmail.com", SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "587" });
    expect(result).toEqual({ configured: false, reason: expect.stringContaining("SMTP_USER") });
    expect(JSON.stringify(result)).not.toContain("UNIT_TEST_PLACEHOLDER_ONLY");
  });

  it("derives STARTTLS defaults from port 587 and validates explicit SSL settings", () => {
    expect(getSmtpConfiguration(completeEnvironment)).toMatchObject({ configured: true, config: { port: 587, secure: false } });
    expect(getSmtpConfiguration({ ...completeEnvironment, SMTP_PORT: "465", SMTP_SECURE: "true" })).toMatchObject({ configured: true, config: { port: 465, secure: true } });
    expect(getSmtpConfiguration({ ...completeEnvironment, SMTP_PORT: "not-a-port" })).toMatchObject({ configured: false, reason: "قيمة SMTP_PORT غير صالحة." });
  });

  it("does not create a network transport when SMTP is not configured", async () => {
    const createTransport = vi.fn();
    const result = await sendAdminInvitationEmail({ recipient: "invitee@gmail.com", origin: "https://family.example", expiresAt: Date.UTC(2026, 0, 1) }, { environment: {}, createTransport });
    expect(result).toMatchObject({ delivered: false, status: "not_configured" });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("sends an invitation through an injected transport without leaking the application password", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "message-17" });
    const result = await sendAdminInvitationEmail({ recipient: "invitee@gmail.com", origin: "https://family.example", expiresAt: Date.UTC(2026, 0, 1) }, { environment: completeEnvironment, createTransport: () => ({ sendMail }) });
    expect(result).toEqual({ delivered: true, status: "sent", messageId: "message-17" });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "invitee@gmail.com", subject: expect.stringContaining("دعوة"), text: expect.stringContaining("سجل الدخول عبر Google") }));
    expect(JSON.stringify(sendMail.mock.calls)).not.toContain("UNIT_TEST_PLACEHOLDER_ONLY");
  });

  it("keeps market-review messages free of prices, balances, and personal recommendations", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "message-18" });
    await sendMarketReviewEmail({ recipient: "owner@gmail.com", origin: "https://family.example" }, { environment: completeEnvironment, createTransport: () => ({ sendMail }) });
    const message = sendMail.mock.calls[0]?.[0] as { text: string };
    expect(message.text).toContain("لا تتضمن أسعارًا أو أرصدة");
    expect(message.text).not.toMatch(/[0-9]{2,}(?:[.,][0-9]+)/);
  });

  it("returns a safe failed result when connection verification fails", async () => {
    const result = await verifySmtpConnection({ environment: completeEnvironment, createTransport: () => ({ sendMail: vi.fn(), verify: vi.fn().mockRejectedValue(new Error("bad password")) }) });
    expect(result).toMatchObject({ delivered: false, status: "failed" });
    expect(JSON.stringify(result)).not.toContain("bad password");
  });
});
