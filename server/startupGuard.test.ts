import { describe, expect, it } from "vitest";
import { validateProductionJwtSecret } from "./auditorTokenService";
import { getMysqlPoolConfig } from "./db";

describe("Production Startup Guard & MySQL Pool Configuration", () => {
  describe("validateProductionJwtSecret", () => {
    it("throws fatal error in production when JWT_SECRET is missing", () => {
      expect(() => {
        validateProductionJwtSecret({ NODE_ENV: "production" } as any);
      }).toThrow("[FATAL] Production startup rejected: JWT_SECRET environment variable is missing.");
    });

    it("throws fatal error in production when JWT_SECRET is shorter than 32 characters", () => {
      expect(() => {
        validateProductionJwtSecret({
          NODE_ENV: "production",
          JWT_SECRET: "short-secret-under-32-chars",
        } as any);
      }).toThrow("below the minimum required length of 32 characters");
    });

    it("throws fatal error in production when JWT_SECRET contains weak or placeholder strings", () => {
      expect(() => {
        validateProductionJwtSecret({
          NODE_ENV: "production",
          JWT_SECRET: "my-production-secret-password-12345678-long",
        } as any);
      }).toThrow("matches a known weak, default, or placeholder secret");

      expect(() => {
        validateProductionJwtSecret({
          NODE_ENV: "production",
          JWT_SECRET: "family_auditor_secret_hmac_fallback_key_2026_institutional",
        } as any);
      }).toThrow("matches a known weak, default, or placeholder secret");
    });

    it("accepts a strong 32+ character secret in production", () => {
      const strongSecret = "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d_SECURE_TOKEN_PROD_2026";
      const validated = validateProductionJwtSecret({
        NODE_ENV: "production",
        JWT_SECRET: strongSecret,
      } as any);
      expect(validated).toBe(strongSecret);
    });

    it("returns development fallback key in non-production environments when secret is unset", () => {
      const devKey = validateProductionJwtSecret({
        NODE_ENV: "development",
      } as any);
      expect(devKey).toBe("family_auditor_secret_hmac_fallback_key_2026_institutional");
    });
  });

  describe("getMysqlPoolConfig", () => {
    it("returns standard fallback pool settings when env vars are absent", () => {
      const config = getMysqlPoolConfig({} as any);
      expect(config.connectionLimit).toBe(10);
      expect(config.maxIdle).toBe(10);
      expect(config.idleTimeout).toBe(60000);
      expect(config.enableKeepAlive).toBe(true);
      expect(config.keepAliveInitialDelay).toBe(0);
    });

    it("respects custom pool configurations from environment variables", () => {
      const config = getMysqlPoolConfig({
        DATABASE_URL: "mysql://user:pass@localhost:3306/family_db",
        DB_CONNECTION_LIMIT: "25",
        DB_MAX_IDLE: "15",
        DB_IDLE_TIMEOUT_MS: "30000",
      } as any);

      expect(config.uri).toBe("mysql://user:pass@localhost:3306/family_db");
      expect(config.connectionLimit).toBe(25);
      expect(config.maxIdle).toBe(15);
      expect(config.idleTimeout).toBe(30000);
    });

    it("handles invalid or non-numeric environment values safely with fallbacks", () => {
      const config = getMysqlPoolConfig({
        DB_CONNECTION_LIMIT: "invalid",
        DB_MAX_IDLE: "-5",
        DB_IDLE_TIMEOUT_MS: "not-a-number",
      } as any);

      expect(config.connectionLimit).toBe(10);
      expect(config.maxIdle).toBe(10);
      expect(config.idleTimeout).toBe(60000);
    });
  });
});
