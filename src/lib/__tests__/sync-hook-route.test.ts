import { afterEach, describe, expect, it, vi } from "vitest";

const mockSubmitRuntimeBatch = vi.fn();

vi.mock("@/lib/runtime-batches", () => ({
  submitRuntimeBatch: mockSubmitRuntimeBatch,
}));

describe("sync-hook route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SYNC_TOKEN;
    delete process.env.PRIVATE_API_TOKEN;
  });

  it("rejects unauthorized requests before batch submission", async () => {
    process.env.SYNC_TOKEN = "secret-token";
    const { POST } = await import("@/app/api/sync-hook/route");

    const response = await POST(new Request("http://localhost/api/sync-hook", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: "unauthorized" });
    expect(mockSubmitRuntimeBatch).not.toHaveBeenCalled();
  });

  it("returns the created batch payload and request key for a new submission", async () => {
    process.env.SYNC_TOKEN = "secret-token";
    mockSubmitRuntimeBatch.mockReturnValue({
      outcome: "created",
      batch: {
        batchId: "batch-123",
        source: "sync-hook",
        counts: {
          queued: 0,
          started: 2,
          pending: 1,
          skipped: 3,
          failed: 0,
          completed: 0,
        },
        request: {
          requestKey: "sync-hook:delivery-123",
          idempotencyKey: "delivery-123",
          identityStrategy: "idempotency-key",
        },
      },
      items: [{ videoId: "alpha123xyz89" }, { videoId: "beta123xyz89" }],
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

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      ok: true,
      outcome: "created",
      itemCount: 2,
      counts: {
        started: 2,
        pending: 1,
        skipped: 3,
      },
      request: {
        requestKey: "sync-hook:delivery-123",
        idempotencyKey: "delivery-123",
        identityStrategy: "idempotency-key",
      },
    });
    expect(mockSubmitRuntimeBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "sync-hook",
        logPrefix: "[sync-hook]",
        request: expect.objectContaining({
          requestKey: "sync-hook:delivery-123",
          idempotencyKey: "delivery-123",
          identityStrategy: "idempotency-key",
        }),
      }),
    );
  });

  it("reuses an existing batch when the request key is replayed", async () => {
    process.env.SYNC_TOKEN = "secret-token";
    mockSubmitRuntimeBatch.mockReturnValue({
      outcome: "reused",
      batch: {
        batchId: "batch-123",
        source: "sync-hook",
        counts: {
          queued: 0,
          started: 0,
          pending: 0,
          skipped: 4,
          failed: 0,
          completed: 0,
        },
        request: {
          requestKey: "sync-hook:delivery-123",
          idempotencyKey: "delivery-123",
          identityStrategy: "idempotency-key",
        },
      },
      items: [{ videoId: "alpha123xyz89" }],
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

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      outcome: "reused",
      counts: {
        skipped: 4,
      },
      request: {
        requestKey: "sync-hook:delivery-123",
        identityStrategy: "idempotency-key",
      },
    });
  });

  it("accepts PRIVATE_API_TOKEN as a universal override", async () => {
    process.env.SYNC_TOKEN = "sync-secret";
    process.env.PRIVATE_API_TOKEN = "private-secret";
    mockSubmitRuntimeBatch.mockReturnValue({
      outcome: "created",
      batch: {
        batchId: "batch-456",
        source: "sync-hook",
        counts: { queued: 0, started: 1, pending: 0, skipped: 0, failed: 0, completed: 0 },
        request: {
          requestKey: "sync-hook:fingerprint:abc",
          identityStrategy: "time-window-fingerprint",
        },
      },
      items: [{ videoId: "test123xyz89" }],
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

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
