import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRefreshSourceCatalog = vi.fn();
const mockSubmitRuntimeBatch = vi.fn();

vi.mock("@/lib/source-refresh", () => ({
  refreshSourceCatalog: mockRefreshSourceCatalog,
}));

vi.mock("@/lib/runtime-batches", () => ({
  submitRuntimeBatch: mockSubmitRuntimeBatch,
}));

describe("sync-hook route", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SYNC_TOKEN;
    delete process.env.PRIVATE_API_TOKEN;
  });

  it("rejects unauthorized requests before refresh begins", async () => {
    process.env.SYNC_TOKEN = "secret-token";
    const { POST } = await import("@/app/api/sync-hook/route");

    const response = await POST(new Request("http://localhost/api/sync-hook", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: "unauthorized" });
    expect(mockRefreshSourceCatalog).not.toHaveBeenCalled();
    expect(mockSubmitRuntimeBatch).not.toHaveBeenCalled();
  });

  it("returns the refresh record and request key for an updated source refresh", async () => {
    process.env.SYNC_TOKEN = "secret-token";
    mockRefreshSourceCatalog.mockReturnValue({
      outcome: "updated",
      phase: "completed",
      trigger: "sync-hook",
      request: {
        requestKey: "sync-hook:delivery-123",
        idempotencyKey: "delivery-123",
        identityStrategy: "idempotency-key",
      },
      repo: {
        remote: "origin",
        branch: "master",
        headBefore: "abc123",
        headAfter: "def456",
        upstreamHead: "def456",
      },
      catalog: {
        version: "catalog-v2",
        videoCount: 42,
        partCount: 80,
        checkOnly: false,
      },
    });

    const { POST } = await import("@/app/api/sync-hook/route");
    const response = await POST(
      new Request("http://localhost/api/sync-hook", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-token",
          "x-sync-request-id": "delivery-123",
          "content-type": "application/json",
        },
        body: JSON.stringify({ trigger: "sync" }),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      outcome: "updated",
      phase: "completed",
      request: {
        requestKey: "sync-hook:delivery-123",
        idempotencyKey: "delivery-123",
        identityStrategy: "idempotency-key",
      },
      repo: {
        headBefore: "abc123",
        headAfter: "def456",
      },
      catalog: {
        version: "catalog-v2",
        videoCount: 42,
        partCount: 80,
      },
    });
    expect(mockRefreshSourceCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "sync-hook",
        request: expect.objectContaining({
          requestKey: "sync-hook:delivery-123",
          idempotencyKey: "delivery-123",
          identityStrategy: "idempotency-key",
        }),
      }),
    );
    expect(mockSubmitRuntimeBatch).not.toHaveBeenCalled();
  });

  it("returns noop refresh outcomes for replayed deliveries without starting analysis", async () => {
    process.env.SYNC_TOKEN = "secret-token";
    mockRefreshSourceCatalog.mockReturnValue({
      outcome: "noop",
      phase: "completed",
      trigger: "sync-hook",
      request: {
        requestKey: "sync-hook:delivery-123",
        idempotencyKey: "delivery-123",
        identityStrategy: "idempotency-key",
      },
      repo: {
        remote: "origin",
        branch: "master",
        headBefore: "def456",
        headAfter: "def456",
        upstreamHead: "def456",
      },
      catalog: {
        version: "catalog-v2",
        videoCount: 42,
        partCount: 80,
        checkOnly: false,
      },
    });

    const { POST } = await import("@/app/api/sync-hook/route");
    const response = await POST(
      new Request("http://localhost/api/sync-hook", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-token",
          "x-sync-request-id": "delivery-123",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      outcome: "noop",
      request: {
        requestKey: "sync-hook:delivery-123",
      },
      repo: {
        headBefore: "def456",
        headAfter: "def456",
      },
    });
    expect(mockSubmitRuntimeBatch).not.toHaveBeenCalled();
  });

  it("accepts PRIVATE_API_TOKEN as a universal override and returns failed refresh results honestly", async () => {
    process.env.SYNC_TOKEN = "sync-secret";
    process.env.PRIVATE_API_TOKEN = "private-secret";
    mockRefreshSourceCatalog.mockReturnValue({
      outcome: "failed",
      phase: "git-fast-forward",
      trigger: "sync-hook",
      request: {
        requestKey: "sync-hook:fingerprint:abc",
        identityStrategy: "time-window-fingerprint",
      },
      repo: {
        remote: "origin",
        branch: "master",
        headBefore: "abc123",
        headAfter: "abc123",
        upstreamHead: "def456",
      },
      catalog: {
        version: "catalog-v1",
        videoCount: 40,
        partCount: 76,
        checkOnly: false,
      },
      error: {
        message: "Not possible to fast-forward, aborting.",
      },
    });

    const { POST } = await import("@/app/api/sync-hook/route");
    const response = await POST(
      new Request("http://localhost/api/sync-hook", {
        method: "POST",
        headers: {
          authorization: "Bearer private-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ trigger: "test" }),
      }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      outcome: "failed",
      phase: "git-fast-forward",
      error: {
        message: "Not possible to fast-forward, aborting.",
      },
    });
    expect(mockSubmitRuntimeBatch).not.toHaveBeenCalled();
  });
});
