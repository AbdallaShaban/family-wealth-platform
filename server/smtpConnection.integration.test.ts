import { describe, expect, it } from "vitest";
import { getSmtpConfiguration, isSmtpSendingEnabled, verifySmtpConnection } from "./mailer";

describe("configured SMTP connection", () => {
  it("verifies the supplied transport only when all secret environment variables are present", async () => {
    const configuration = getSmtpConfiguration();
    if (!configuration.configured) {
      expect(configuration.reason).toContain("SMTP");
      return;
    }

    const result = await verifySmtpConnection();
    if (!isSmtpSendingEnabled()) {
      expect(result).toMatchObject({ delivered: false, status: "not_configured" });
      return;
    }
    expect(result).toEqual({ delivered: true, status: "sent", messageId: null });
  }, 20_000);
});
