import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { randomUUID } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleScheduledMarketRefresh } from "../marketRefreshHandler";
import { startMarketAutomationDaemon } from "../marketScheduler";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { validateProductionJwtSecret } from "../auditorTokenService";

const operationalMetrics = { startedAt: Date.now(), requests: 0, responses5xx: 0, totalResponseMs: 0, lastRequestAt: null as number | null };

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateProductionJwtSecret();
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use((req, res, next) => {
    const startedAt = performance.now();
    res.setHeader("x-request-id", randomUUID());
    res.on("finish", () => {
      const durationMs = performance.now() - startedAt;
      operationalMetrics.requests += 1;
      operationalMetrics.totalResponseMs += durationMs;
      operationalMetrics.lastRequestAt = Date.now();
      if (res.statusCode >= 500) operationalMetrics.responses5xx += 1;
      if (process.env.NODE_ENV === "development" && !req.path.startsWith("/metrics")) console.info(`[HTTP] ${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
    });
    next();
  });
  app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok", service: "family-wealth-assessment-live", uptimeSeconds: Math.floor((Date.now() - operationalMetrics.startedAt) / 1000) }));
  app.get("/readyz", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) return res.status(503).json({ status: "not_ready", checks: { database: "unavailable" } });
      await db.execute(sql`SELECT 1`);
      return res.status(200).json({ status: "ready", checks: { database: "ok" } });
    } catch {
      return res.status(503).json({ status: "not_ready", checks: { database: "error" } });
    }
  });
  app.get("/metrics", (_req, res) => {
    const averageResponseMs = operationalMetrics.requests ? operationalMetrics.totalResponseMs / operationalMetrics.requests : 0;
    res.status(200).json({ service: "family-wealth-assessment-live", uptimeSeconds: Math.floor((Date.now() - operationalMetrics.startedAt) / 1000), requests: operationalMetrics.requests, responses5xx: operationalMetrics.responses5xx, averageResponseMs: Number(averageResponseMs.toFixed(2)), lastRequestAt: operationalMetrics.lastRequestAt });
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/scheduled/market-refresh", handleScheduledMarketRefresh);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startMarketAutomationDaemon();
  });
}

startServer().catch(console.error);
