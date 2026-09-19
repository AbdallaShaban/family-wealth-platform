import { describe, expect, it, vi } from "vitest";
import { handleCreateAccount, handleListAccounts } from "../accountsHandler";
import { sdk } from "../_core/sdk";

describe("POST /api/accounts - Route Handler & Auth Guard", () => {
  it("returns JSON 401 error when session cookie/JWT is missing (no redirect to OAuth)", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockRejectedValueOnce(new Error("Invalid session cookie"));

    const req: any = {
      headers: {},
      body: {
        name: "حساب الادخار",
        accountType: "bank",
        currency: "USD",
        openingBalance: "5000",
      },
    };

    let responseStatus: number | null = null;
    let responseJson: any = null;
    let redirected = false;

    const res: any = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
        return this;
      },
      redirect(url: string) {
        redirected = true;
        return this;
      },
    };

    await handleCreateAccount(req, res);

    expect(redirected).toBe(false);
    expect(responseStatus).toBe(401);
    expect(responseJson).toMatchObject({
      error: "unauthorized",
      message: expect.stringContaining("جلسة المستخدم غير صالحة"),
    });
  });

  it("returns JSON 400 error when request payload fails validation", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValueOnce({
      id: 1,
      openId: "test_owner",
      name: "Test User",
      email: "test@example.com",
      role: "user",
      loginMethod: "local",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any);

    const req: any = {
      headers: { cookie: "family_session_token=valid_token" },
      body: {
        name: "x", // too short (min 2)
        accountType: "invalid_type",
        currency: "US", // invalid currency length (must be 3)
      },
    };

    let responseStatus: number | null = null;
    let responseJson: any = null;

    const res: any = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
        return this;
      },
    };

    await handleCreateAccount(req, res);

    expect(responseStatus).toBe(400);
    expect(responseJson).toMatchObject({
      error: "bad_request",
    });
  });

  it("returns JSON 401 when calling GET /api/accounts without authentication", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockRejectedValueOnce(new Error("Missing session"));

    const req: any = { headers: {} };
    let responseStatus: number | null = null;
    let responseJson: any = null;

    const res: any = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
        return this;
      },
    };

    await handleListAccounts(req, res);

    expect(responseStatus).toBe(401);
    expect(responseJson).toMatchObject({
      error: "unauthorized",
    });
  });
});
