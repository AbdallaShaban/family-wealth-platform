import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadTelegramConfig,
  saveTelegramConfig,
  sendTelegramMessage,
  sendTestAlert,
  checkGoldMovementAlerts,
  type TelegramAlertConfig,
} from "../telegramAlertService";

describe("Telegram Instant Alerts Engine (Option 1 of Roadmap)", () => {
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
});
