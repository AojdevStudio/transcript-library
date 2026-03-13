import { afterEach, describe, expect, it, vi } from "vitest";

// Mock hosted-config so we control isHosted() without env coupling
const mockIsHosted = vi.fn();
vi.mock("@/lib/hosted-config", () => ({
  isHosted: () => mockIsHosted(),
  isLocalDev: () => !mockIsHosted(),
}));

describe("private-api-guard", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    mockIsHosted.mockReset();
    vi.resetModules();
  });

  function makeReq(token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers["authorization"] = `Bearer ${token}`;
    return new Request("http://localhost/api/test", { headers });
  }

  async function loadGuard() {
    return await import("@/lib/private-api-guard");
  }

  // --- Local dev: always allowed ---

  it("allows requests in local dev without any token", async () => {
    mockIsHosted.mockReturnValue(false);
    const { requirePrivateApi } = await loadGuard();
    const result = requirePrivateApi(makeReq());
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.reason).toBe("local-dev");
  });

  // --- Hosted mode: token required ---

  it("rejects requests in hosted mode without a token", async () => {
    mockIsHosted.mockReturnValue(true);
    process.env.PRIVATE_API_TOKEN = "secret";
    const { requirePrivateApi } = await loadGuard();
    const result = requirePrivateApi(makeReq());
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.response.status).toBe(401);
  });

  it("rejects requests with the wrong token in hosted mode", async () => {
    mockIsHosted.mockReturnValue(true);
    process.env.PRIVATE_API_TOKEN = "correct-secret";
    const { requirePrivateApi } = await loadGuard();
    const result = requirePrivateApi(makeReq("wrong-secret"));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.response.status).toBe(401);
  });

  it("allows requests with the correct token in hosted mode", async () => {
    mockIsHosted.mockReturnValue(true);
    process.env.PRIVATE_API_TOKEN = "correct-secret";
    const { requirePrivateApi } = await loadGuard();
    const result = requirePrivateApi(makeReq("correct-secret"));
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.reason).toBe("valid-token");
  });

  it("returns 503 in hosted mode when PRIVATE_API_TOKEN is not configured", async () => {
    mockIsHosted.mockReturnValue(true);
    delete process.env.PRIVATE_API_TOKEN;
    const { requirePrivateApi } = await loadGuard();
    const result = requirePrivateApi(makeReq("any-token"));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.response.status).toBe(503);
  });

  // --- sanitizePayload ---

  it("strips sensitive keys in hosted mode", async () => {
    mockIsHosted.mockReturnValue(true);
    const { sanitizePayload } = await loadGuard();
    const input = {
      videoId: "abc123",
      absPath: "/secret/path",
      provider: "claude",
      nested: {
        filePath: "/nested/secret",
        title: "keep this",
      },
      items: [{ workerPid: 1234, name: "item1" }],
    };
    const result = sanitizePayload(input);
    expect(result).toEqual({
      videoId: "abc123",
      nested: { title: "keep this" },
      items: [{ name: "item1" }],
    });
  });

  it("passes through everything in local dev", async () => {
    mockIsHosted.mockReturnValue(false);
    const { sanitizePayload } = await loadGuard();
    const input = { absPath: "/secret/path", videoId: "abc" };
    const result = sanitizePayload(input);
    expect(result).toEqual(input);
  });
});
