import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  loadTelegramConfig,
  saveTelegramConfig,
  sendTelegramMessage,
  sendTestAlert,
  checkGoldMovementAlerts,
  redactSecrets,
  type TelegramAlertConfig,
} from "../telegramAlertService";

vi.mock("axios");

describe("Telegram Instant Alerts Engine - Multi-Tenant Isolation & Security", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and persists telegram configuration with defaults", () => {
    const config = loadTelegramConfig();
    expect(config).toBeDefined();
    expect(typeof config.enabled).toBe("boolean");
    expect(typeof config.enableCertificates).toBe("boolean");
    expect(typeof config.enableGoldMovements).toBe("boolean");
    expect(typeof config.enableZakatHawl).toBe("boolean");
    expect(typeof config.enableWeeklySummary).toBe("boolean");
    expect(config.goldMovementThresholdPct).toBeGreaterThanOrEqual(0.5);
  });

  it("handles saving configuration updates safely", () => {
    const updated = saveTelegramConfig({
      enableCertificates: true,
      enableGoldMovements: true,
      goldMovementThresholdPct: 2.5,
    });
    expect(updated.goldMovementThresholdPct).toBe(2.5);
    expect(updated.enableCertificates).toBe(true);
  });

  it("returns a graceful error when botToken or chatId is missing", async () => {
    const result = await sendTelegramMessage("Test Message", {
      botToken: "",
      chatId: "12345678",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Bot Token");

    const result2 = await sendTelegramMessage("Test Message", {
      botToken: "fake-token-12345",
      chatId: "",
    });
    expect(result2.success).toBe(false);
    expect(result2.error).toContain("Chat ID");
  });

  it("formats certificate maturity message with proper days and Arabic numerals", () => {
    const cert = {
      bankName: "بنك مصر",
      certificateName: "شهادة القمة الادخارية 27%",
      principalAmount: "500000",
      interestRate: "27",
      currency: "EGP",
      daysLeft: 7,
      dateStr: "10 أكتوبر 2026",
    };

    const text = `
⏳ <b>تنبيه اقتراب موعد استحقاق شهادة بنكية (7 أيام)</b>
🏛 <b>البنك المصدر:</b> ${cert.bankName}
📜 <b>اسم الشهادة:</b> ${cert.certificateName}
💰 <b>أصل المبلغ:</b> ${Number(cert.principalAmount).toLocaleString()} ${cert.currency}
    `.trim();

    expect(text).toContain("بنك مصر");
    expect(text).toContain("500,000 EGP");
    expect(text).toContain("7 أيام");
  });

  it("formats sharp gold movement alert with 24k price and 85g Nisab", () => {
    const current24k = 7120;
    const prev = 6950;
    const pct = ((current24k - prev) / prev) * 100;
    const nisab = current24k * 85;

    const text = `
📈 <b>تنبيه تحرك حاد في أسعار الذهب بالسوق المصري (+${pct.toFixed(1)}%)</b>
🥇 <b>عيار 24:</b> ${current24k.toLocaleString()} ج.م للجرام
⚖️ <b>نصاب الزكاة الشرعي الجديد (85 جرام):</b> ${nisab.toLocaleString()} ج.م
    `.trim();

    expect(pct).toBeGreaterThan(2.0);
    expect(text).toContain("7,120 ج.م");
    expect(text).toContain("605,200 ج.م");
  });

  /* ================= Phase 2: Multi-Tenant Isolation Tests ================= */

  it("ensures workspace A cannot read or overwrite workspace B configuration", () => {
    const wsA = 901;
    const wsB = 902;

    // Save config for workspace A
    saveTelegramConfig(wsA, {
      botToken: "token-secret-for-workspace-A",
      chatId: "chat-11111",
      enabled: true,
      goldMovementThresholdPct: 3.0,
    });

    // Save config for workspace B
    saveTelegramConfig(wsB, {
      botToken: "token-secret-for-workspace-B",
      chatId: "chat-22222",
      enabled: false,
      goldMovementThresholdPct: 1.5,
    });

    // Read workspace A
    const configA = loadTelegramConfig(wsA);
    expect(configA.botToken).toBe("token-secret-for-workspace-A");
    expect(configA.chatId).toBe("chat-11111");
    expect(configA.enabled).toBe(true);
    expect(configA.goldMovementThresholdPct).toBe(3.0);

    // Read workspace B
    const configB = loadTelegramConfig(wsB);
    expect(configB.botToken).toBe("token-secret-for-workspace-B");
    expect(configB.chatId).toBe("chat-22222");
    expect(configB.enabled).toBe(false);
    expect(configB.goldMovementThresholdPct).toBe(1.5);

    // Modifying workspace A does NOT alter workspace B
    saveTelegramConfig(wsA, { chatId: "chat-updated-A" });
    const configBAfter = loadTelegramConfig(wsB);
    expect(configBAfter.chatId).toBe("chat-22222");
    expect(loadTelegramConfig(wsA).chatId).toBe("chat-updated-A");
  });

  it("does NOT auto-distribute legacy shared config to new unconfigured workspaces", () => {
    const unconfiguredWs = 8888;
    const config = loadTelegramConfig(unconfiguredWs);

    // Should return clean defaults, never leaking tokens or chats
    expect(config.botToken).toBe("");
    expect(config.chatId).toBe("");
  });

  it("does NOT wipe saved botToken when updates contain masked token or omit token", () => {
    const ws = 903;
    saveTelegramConfig(ws, {
      botToken: "real-secret-token-12345",
      chatId: "chat-903",
    });

    // Updating with masked token should preserve existing real token
    const afterMaskedUpdate = saveTelegramConfig(ws, {
      botToken: "real-s••••••••2345",
      enabled: false,
    });
    expect(afterMaskedUpdate.botToken).toBe("real-secret-token-12345");
    expect(afterMaskedUpdate.enabled).toBe(false);

    // Updating without botToken field should preserve existing token
    const afterOmitUpdate = saveTelegramConfig(ws, {
      chatId: "chat-new-903",
    });
    expect(afterOmitUpdate.botToken).toBe("real-secret-token-12345");
    expect(afterOmitUpdate.chatId).toBe("chat-new-903");
  });

  it("redacts bot tokens from URLs and error logs", () => {
    const rawUrl = "https://api.telegram.org/bot1234567890:ABCdefGHIjklMNOpqrsTUVwxyz/sendMessage";
    const redacted = redactSecrets(rawUrl);
    expect(redacted).not.toContain("1234567890:ABCdefGHIjklMNOpqrsTUVwxyz");
    expect(redacted).toContain("/bot[REDACTED]/sendMessage");

    const rawError = "Request failed for bot 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz: Bad Request";
    const redactedError = redactSecrets(rawError);
    expect(redactedError).not.toContain("1234567890:ABCdefGHIjklMNOpqrsTUVwxyz");
    expect(redactedError).toContain("[REDACTED_BOT_TOKEN]");
  });

  it("sends telegram message using the correct workspace credentials", async () => {
    const ws1 = 904;
    const ws2 = 905;

    saveTelegramConfig(ws1, {
      botToken: "bot-token-ws1",
      chatId: "chat-id-ws1",
    });
    saveTelegramConfig(ws2, {
      botToken: "bot-token-ws2",
      chatId: "chat-id-ws2",
    });

    const postMock = vi.mocked(axios.post).mockResolvedValue({
      data: { ok: true, result: { message_id: 42 } },
    } as any);

    await sendTelegramMessage("Alert for ws1", { workspaceId: ws1 });
    expect(postMock).toHaveBeenLastCalledWith(
      "https://api.telegram.org/botbot-token-ws1/sendMessage",
      expect.objectContaining({ chat_id: "chat-id-ws1", text: "Alert for ws1" }),
      expect.anything()
    );

    await sendTelegramMessage("Alert for ws2", { workspaceId: ws2 });
    expect(postMock).toHaveBeenLastCalledWith(
      "https://api.telegram.org/botbot-token-ws2/sendMessage",
      expect.objectContaining({ chat_id: "chat-id-ws2", text: "Alert for ws2" }),
      expect.anything()
    );
  });
});
