import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getMarketDaemonStatus } from "../marketScheduler";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(async () => {
      const db = await getDb();
      let dbStatus = "unavailable";
      if (db) {
        try {
          await db.execute(sql`SELECT 1`);
          dbStatus = "ok";
        } catch {
          dbStatus = "error";
        }
      }
      const scheduler = getMarketDaemonStatus();
      return {
        ok: dbStatus === "ok",
        database: dbStatus,
        scheduler: {
          active: scheduler.active,
          lastExecutionTimestamp: scheduler.lastExecutionTimestamp,
        },
      };
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
