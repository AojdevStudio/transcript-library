import fs from "node:fs";
import { insightDir, analysisPath, insightsBaseDir } from "@/lib/analysis";
import { curateYouTubeAnalyzer } from "@/lib/curation";

export function insightPaths(videoId: string) {
  const dir = insightDir(videoId);
  return {
    dir,
    analysis: analysisPath(videoId),
    legacy: `${insightsBaseDir()}/${videoId}.md`,
  };
}

export function readInsightMarkdown(videoId: string): {
  kind: "analysis" | "legacy" | "none";
  markdown: string | null;
  path: string | null;
} {
  const p = insightPaths(videoId);
  try {
    const md = fs.readFileSync(p.analysis, "utf8");
    return { kind: "analysis", markdown: md, path: p.analysis };
  } catch {}

  try {
    const md = fs.readFileSync(p.legacy, "utf8");
    return { kind: "legacy", markdown: md, path: p.legacy };
  } catch {}

  return { kind: "none", markdown: null, path: null };
}

function stripFrontmatter(md: string) {
  if (!md.startsWith("---")) return md;
  const idx = md.indexOf("\n---", 3);
  if (idx === -1) return md;
  // consume the closing --- line
  const after = md.indexOf("\n", idx + 4);
  return after === -1 ? "" : md.slice(after + 1);
}

export function makePreview(md: string, maxChars = 260) {
  const curated = curateYouTubeAnalyzer(md);
  if (curated.summary) {
    const s = curated.summary.trim();
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars - 1).trimEnd() + "…";
  }

  const body = stripFrontmatter(md)
    .replace(/\r/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Prefer first non-empty paragraph.
  const paras = body.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  const first = paras[0] || "";
  const oneLine = first.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxChars) return oneLine;
  return oneLine.slice(0, maxChars - 1).trimEnd() + "…";
}
