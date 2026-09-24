import type { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = "تم تجاوز الحد المسموح به من الطلبات. يرجى المحاولة لاحقاً.",
    keyGenerator = (req: Request) => {
      const forwarded = req.headers["x-forwarded-for"];
      if (typeof forwarded === "string") {
        return forwarded.split(",")[0].trim();
      }
      return req.ip || req.socket.remoteAddress || "unknown-ip";
    },
    skip = () => false,
  } = options;

  const hits = new Map<string, ClientRecord>();

  // Periodic cleanup of stale IP records every 60 seconds
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    hits.forEach((record, key) => {
      if (now >= record.resetTime) {
        hits.delete(key);
      }
    });
  }, 60_000);
  cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    let record = hits.get(key);

    if (!record || now >= record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", resetSeconds);

    if (record.count > max) {
      res.setHeader("Retry-After", resetSeconds);
      return res.status(429).json({
        error: message,
        retryAfterSeconds: resetSeconds,
      });
    }

    next();
  };
}

/**
 * Strict Rate Limiter for Authentication Mutations (login, register):
 * Max 15 requests per 15 minutes per IP
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: "تم تجاوز محاولات تسجيل الدخول المسموح بها (15 محاولة لكل 15 دقيقة). يرجى الانتظار والمحاولة لاحقاً.",
  skip: (req) => {
    // Only apply to auth endpoints (login, register)
    const url = req.originalUrl || req.url || "";
    const isAuthRoute =
      url.includes("auth.login") ||
      url.includes("auth.register") ||
      url.includes("auth.signup");
    return !isAuthRoute;
  },
});

/**
 * Standard Operational Rate Limiter for tRPC queries and mutations:
 * Max 150 requests per minute per IP
 */
export const trpcApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 150,
  message: "تم تجاوز الحد التشغيلي للطلبات (150 طلب لكل دقيقة). يرجى التمهل قبل إعادة المحاولة.",
  skip: (req) => {
    const url = req.originalUrl || req.url || "";
    // Skip if it's health checks or static assets
    if (url.startsWith("/healthz") || url.startsWith("/readyz") || url.startsWith("/metrics")) {
      return true;
    }
    // Only apply to /api/trpc
    return !url.startsWith("/api/trpc");
  },
});
