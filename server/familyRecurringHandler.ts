import type { Request, Response } from "express";
import { runRecurringRuleByTaskUid } from "./familyRecurring";
import { sdk } from "./_core/sdk";

/** Callback exclusively for Manus Heartbeat; task identity comes from the signed session, never request JSON. */
export async function handleRecurringHeartbeat(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    return res.json(await runRecurringRuleByTaskUid(user.taskUid));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[FAMILY recurring heartbeat]", error);
    return res.status(500).json({ error: message, stack, context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}
