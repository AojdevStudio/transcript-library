import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Integration-level test that proves guarded routes reject untrusted callers
 * in hosted mode and allow local dev access without tokens.
 *
 * Each route is imported dynamically so vi.mock and env overrides take effect.
 */

// --- Shared mocks ---

const mockIsHosted = vi.fn();
vi.mock("@/lib/hosted-config", () => ({
  isHosted: () => mockIsHosted(),
  isLocalDev: () => !mockIsHosted(),
}));

// Mock catalog/analysis modules so routes don't need real data
vi.mock("@/modules/catalog", () => ({
  getVideo: vi.fn().mockReturnValue(null),
  listVideosByChannel: vi.fn().mockReturnValue([]),
  listChannels: vi.fn().mockReturnValue([]),
  absTranscriptPath: vi.fn().mockReturnValue("/tmp/fake"),
}));

vi.mock("@/modules/analysis", () => ({
  isValidVideoId: vi.fn().mockReturnValue(true),
  getAnalyzeStartEligibility: vi.fn().mockReturnValue({
    canStart: false,
    outcome: "already-analyzed",
    message: "done",
    retryable: false,
    snapshot: { lifecycle: "complete" },
  }),
  readRuntimeSnapshot: vi.fn().mockReturnValue({
    status: "idle",
    run: null,
    lifecycle: null,
  }),
  spawnAnalysis: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/runtime-reconciliation", () => ({
  reconcileRuntimeArtifacts: vi.fn().mockReturnValue({
    status: "consistent",
    reasons: [],
  }),
}));

vi.mock("@/lib/runtime-stream", () => ({
  readRuntimeStreamEvent: vi.fn().mockReturnValue({
    version: "v1",
    payload: { stage: null, logs: [], recentLogs: [], retryGuidance: null },
  }),
}));

vi.mock("@/modules/insights", () => ({
  readInsightMarkdown: vi.fn().mockReturnValue({ markdown: null }),
  readCuratedInsight: vi.fn().mockReturnValue({ curated: null, error: null }),
  getInsightArtifacts: vi.fn().mockReturnValue([]),
  hasBlockedLegacyInsight: vi.fn().mockReturnValue(false),
}));

describe("route access control", () => {
  afterEach(() => {
    mockIsHosted.mockReset();
    vi.clearAllMocks();
    delete process.env.PRIVATE_API_TOKEN;
    delete process.env.PLAYLIST_TRANSCRIPTS_REPO;
  });

  // Set PLAYLIST_TRANSCRIPTS_REPO so /api/raw doesn't 503 from its own logic
  function setRawEnv() {
    process.env.PLAYLIST_TRANSCRIPTS_REPO = "/tmp/fake-transcripts";
  }

  const guardedRoutes = [
    { name: "/api/channels", importPath: "@/app/api/channels/route", method: "GET" },
    {
      name: "/api/channel",
      importPath: "@/app/api/channel/route",
      method: "GET",
      query: "?channel=test",
    },
    {
      name: "/api/video",
      importPath: "@/app/api/video/route",
      method: "GET",
      query: "?videoId=abc123",
    },
    { name: "/api/raw", importPath: "@/app/api/raw/route", method: "GET", query: "?path=test.txt" },
    {
      name: "/api/analyze",
      importPath: "@/app/api/analyze/route",
      method: "POST",
      query: "?videoId=abc123",
    },
    {
      name: "/api/analyze/status",
      importPath: "@/app/api/analyze/status/route",
      method: "GET",
      query: "?videoId=abc123",
    },
    {
      name: "/api/insight",
      importPath: "@/app/api/insight/route",
      method: "GET",
      query: "?videoId=abc123",
    },
    {
      name: "/api/insight/stream",
      importPath: "@/app/api/insight/stream/route",
      method: "GET",
      query: "?videoId=abc123",
    },
  ];

  for (const route of guardedRoutes) {
    it(`${route.name} rejects unauthenticated requests in hosted mode`, async () => {
      mockIsHosted.mockReturnValue(true);
      process.env.PRIVATE_API_TOKEN = "test-secret";
      setRawEnv();

      const mod = await import(route.importPath);
      const handler = mod[route.method];
      const url = `http://localhost${route.name}${route.query ?? ""}`;
      const response = await handler(new Request(url, { method: route.method }));

      expect(response.status).toBe(401);
    });

    it(`${route.name} allows requests in local dev without token`, async () => {
      mockIsHosted.mockReturnValue(false);
      setRawEnv();

      const mod = await import(route.importPath);
      const handler = mod[route.method];
      const url = `http://localhost${route.name}${route.query ?? ""}`;
      const response = await handler(new Request(url, { method: route.method }));

      // Should not be 401 or 503 — any other status means the guard passed
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(503);
    });

    it(`${route.name} allows authenticated requests in hosted mode`, async () => {
      mockIsHosted.mockReturnValue(true);
      process.env.PRIVATE_API_TOKEN = "test-secret";
      setRawEnv();

      const mod = await import(route.importPath);
      const handler = mod[route.method];
      const url = `http://localhost${route.name}${route.query ?? ""}`;
      const response = await handler(
        new Request(url, {
          method: route.method,
          headers: { authorization: "Bearer test-secret" },
        }),
      );

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(503);
    });
  }
});
