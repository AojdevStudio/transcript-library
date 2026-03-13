import { describe, expect, it } from "vitest";
import {
  buildHeadlessAnalysisPrompt,
  type HeadlessAnalysisMeta,
} from "@/lib/headless-youtube-analysis";

const meta: HeadlessAnalysisMeta = {
  schemaVersion: 2,
  source: "fallback",
  videoId: "abc123xyz89",
  title: "Prompt Contract",
  channel: "Transcript Library",
  topic: "software-engineering",
  publishedDate: "2026-03-09",
  sourceUrl: "https://www.youtube.com/watch?v=abc123xyz89",
  githubRepos: [],
  contentType: "tutorial",
  analysisDepth: "standard",
  updatedAt: "2026-03-09T00:00:00.000Z",
};

describe("buildHeadlessAnalysisPrompt", () => {
  it("requests a strict JSON envelope", () => {
    const prompt = buildHeadlessAnalysisPrompt(meta, "Transcript body");

    expect(prompt).toMatch(/return json only/i);
    expect(prompt).toMatch(/do not wrap the response in code fences/i);
    expect(prompt).toMatch(/schemaVersion/i);
    expect(prompt).toMatch(/reportMarkdown/i);
    expect(prompt).toMatch(/takeaways/i);
  });
});
