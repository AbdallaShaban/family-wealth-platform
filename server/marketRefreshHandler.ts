import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { refreshYahooMarketData } from "./marketRefresh";
import { notifyOwner } from "./_core/notification";
import { sendEligibleMarketReviewEmails } from "./marketEmail";

export async function handleScheduledMarketRefresh(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await refreshYahooMarketData();
    if (result.failures.length) {
      await notifyOwner({ title: "FAMILY: بعض أسعار السوق تحتاج مراجعة", content: `تعذر تحديث ${result.failures.length} عنصرًا من بيانات Yahoo Finance. لم تُنشأ أي قيود أو صفقات تلقائية.` });
    }
    let marketEmail = { considered: 0, sent: 0, skipped: 0, failed: 0 };
    try {
      marketEmail = await sendEligibleMarketReviewEmails();
    } catch (error) {
      console.warn("[MarketRefresh] Optional market-email delivery failed", { errorType: error instanceof Error ? error.name : "unknown" });
      await notifyOwner({ title: "FAMILY: تعذر إرسال ملخص مراجعة السوق", content: "اكتمل تحديث بيانات Yahoo Finance، لكن إشعار البريد الاختياري تعذر معالجته. لم تُنشأ أي قيود أو صفقات تلقائية." });
    }
    return res.json({ ok: true, taskUid: user.taskUid, ...result, marketEmail, ranAt: Date.now() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث الأسعار الدورية.";
    return res.status(500).json({ error: message, timestamp: Date.now(), context: { path: req.path } });
  }
}
