import { afterEach, describe, expect, it, vi } from "vitest";

describe("hosted-config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  async function loadModule() {
    return await import("@/lib/hosted-config");
  }

  // --- isHosted / isLocalDev ---

  it("reports local dev when HOSTED is unset", async () => {
    delete process.env.HOSTED;
    const { isHosted, isLocalDev } = await loadModule();
    expect(isHosted()).toBe(false);
    expect(isLocalDev()).toBe(true);
  });

  it("reports hosted when HOSTED=true", async () => {
    process.env.HOSTED = "true";
    const { isHosted, isLocalDev } = await loadModule();
    expect(isHosted()).toBe(true);
    expect(isLocalDev()).toBe(false);
  });

  it("reports hosted when HOSTED=1", async () => {
    process.env.HOSTED = "1";
    const { isHosted } = await loadModule();
    expect(isHosted()).toBe(true);
  });

  it("reports local dev for other HOSTED values", async () => {
    process.env.HOSTED = "false";
    const { isHosted } = await loadModule();
    expect(isHosted()).toBe(false);
  });

  // --- runPreflight ---

  it("passes in local dev with no env vars", async () => {
    delete process.env.HOSTED;
    delete process.env.PLAYLIST_TRANSCRIPTS_REPO;
    delete process.env.PRIVATE_API_TOKEN;
    const { runPreflight } = await loadModule();
    const result = runPreflight();
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("local");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("fails in hosted mode when PLAYLIST_TRANSCRIPTS_REPO is missing", async () => {
    process.env.HOSTED = "true";
    delete process.env.PLAYLIST_TRANSCRIPTS_REPO;
    process.env.PRIVATE_API_TOKEN = "test-token";
    const { runPreflight } = await loadModule();
    const result = runPreflight();
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("PLAYLIST_TRANSCRIPTS_REPO"))).toBe(true);
  });

  it("fails in hosted mode when PRIVATE_API_TOKEN is missing", async () => {
    process.env.HOSTED = "true";
    process.env.PLAYLIST_TRANSCRIPTS_REPO = "/tmp/transcripts";
    delete process.env.PRIVATE_API_TOKEN;
    const { runPreflight } = await loadModule();
    const result = runPreflight();
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("PRIVATE_API_TOKEN"))).toBe(true);
  });

  it("passes in hosted mode when all required vars are set", async () => {
    process.env.HOSTED = "true";
    process.env.PLAYLIST_TRANSCRIPTS_REPO = "/tmp/transcripts";
    process.env.PRIVATE_API_TOKEN = "test-token";
    process.env.SYNC_TOKEN = "sync-secret";
    const { runPreflight } = await loadModule();
    const result = runPreflight();
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("hosted");
    expect(result.errors).toHaveLength(0);
  });

  it("warns in hosted mode when SYNC_TOKEN is missing", async () => {
    process.env.HOSTED = "true";
    process.env.PLAYLIST_TRANSCRIPTS_REPO = "/tmp/transcripts";
    process.env.PRIVATE_API_TOKEN = "test-token";
    delete process.env.SYNC_TOKEN;
    const { runPreflight } = await loadModule();
    const result = runPreflight();
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("SYNC_TOKEN"))).toBe(true);
  });

  // --- assertPreflight ---

  it("throws in hosted mode on missing required vars", async () => {
    process.env.HOSTED = "true";
    delete process.env.PLAYLIST_TRANSCRIPTS_REPO;
    delete process.env.PRIVATE_API_TOKEN;
    const { assertPreflight } = await loadModule();
    expect(() => assertPreflight()).toThrow(/Hosted preflight failed/);
  });

  it("does not throw in local dev with no vars", async () => {
    delete process.env.HOSTED;
    delete process.env.PLAYLIST_TRANSCRIPTS_REPO;
    delete process.env.PRIVATE_API_TOKEN;
    const { assertPreflight } = await loadModule();
    expect(() => assertPreflight()).not.toThrow();
  });
});
