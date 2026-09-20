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
import { serveStatic } from "./vite";
import { handleScheduledMarketRefresh } from "../marketRefreshHandler";
import { handleCreateAccount, handleListAccounts } from "../accountsHandler";
import { startMarketAutomationDaemon } from "../marketScheduler";
import { sql } from "drizzle-orm";
import { ensurePasswordHashColumn, getDb } from "../db";
import { validateProductionJwtSecret } from "../auditorTokenService";

const operationalMetrics = { startedAt: Date.now(), requests: 0, responses5xx: 0, totalResponseMs: 0, lastRequestAt: null as number | null };

function isPortAvailable(port: number, host: string = "0.0.0.0"): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000, host: string = "0.0.0.0"): Promise<number> {
  if (process.env.NODE_ENV === "production") {
    const available = await isPortAvailable(startPort, host);
    if (!available) {
      throw new Error(`[Production Error] Port ${startPort} on host ${host} is already in use. Refusing dynamic port fallback in production mode.`);
    }
    return startPort;
  }
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort} on host ${host}`);
}

async function startServer() {
  validateProductionJwtSecret();
  try {
    await ensurePasswordHashColumn();
  } catch (err) {
    console.warn("[Startup] ensurePasswordHashColumn warning:", err);
  }
  const app = express();
  app.set("trust proxy", 1);

  // Intercept malformed URI requests to prevent unhandled URIError crashes
  app.use((req, res, next) => {
    try {
      decodeURI(req.path);
      decodeURIComponent(req.path);
      next();
    } catch {
      return res.status(400).end("Bad Request: Malformed URI");
    }
  });

  const server = createServer(app);

  // Standard payload parser (2MB) for general APIs; large payload (50MB) scoped strictly to file uploads & statement imports
  const standardJson = express.json({ limit: "2mb" });
  const standardUrlencoded = express.urlencoded({ limit: "2mb", extended: true });
  const largeJson = express.json({ limit: "50mb" });
  const largeUrlencoded = express.urlencoded({ limit: "50mb", extended: true });

  const isLargePayloadRoute = (req: express.Request) => {
    const targetUrl = req.originalUrl || req.url || req.path || "";
    return (
      targetUrl.includes("vault") ||
      targetUrl.includes("import") ||
      targetUrl.includes("statement") ||
      targetUrl.includes("backup") ||
      targetUrl.includes("upload")
    );
  };

  app.use((req, res, next) => {
    if (isLargePayloadRoute(req)) {
      largeJson(req, res, next);
    } else {
      standardJson(req, res, next);
    }
  });

  app.use((req, res, next) => {
    if (isLargePayloadRoute(req)) {
      largeUrlencoded(req, res, next);
    } else {
      standardUrlencoded(req, res, next);
    }
  });
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
  app.post("/api/accounts", handleCreateAccount);
  app.get("/api/accounts", handleListAccounts);
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
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Handle any uncaught URIErrors or malformed requests gracefully
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof URIError) {
      return res.status(400).end("Bad Request: Malformed URI");
    }
    next(err);
  });

  const host = process.env.HOST || "0.0.0.0";
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort, host);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, host, () => {
    console.log(`Server running on http://localhost:${port}/ (bound to ${host})`);
    startMarketAutomationDaemon();
  });
}

startServer().catch(err => {
  console.error("[Fatal Server Startup Error]", err);
  process.exit(1);
});
