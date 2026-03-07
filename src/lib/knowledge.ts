import fs from "node:fs";
import path from "node:path";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "knowledge");

function isSafeSegment(s: string) {
  // disallow traversal + weird separators
  return !!s && !s.includes("..") && !s.includes("/") && !s.includes("\\");
}

export function knowledgeExists(): boolean {
  try {
    return fs.existsSync(KNOWLEDGE_ROOT) && fs.statSync(KNOWLEDGE_ROOT).isDirectory();
  } catch {
    return false;
  }
}

export function listKnowledgeCategories(): string[] {
  if (!knowledgeExists()) return [];

  const entries = fs.readdirSync(KNOWLEDGE_ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !n.startsWith("."))
    .sort((a, b) => a.localeCompare(b));
}

export function curatedKnowledgeCategories(all: string[]): string[] {
  const preferredOrder = [
    "technology",
    "health",
    "business",
    "finance",
    "science",
    "education",
    "general",
    "checklists",
    "social-media",
    "politics",
    "entertainment",
    "articles",
  ];

  const set = new Set(all);
  const curated = preferredOrder.filter((c) => set.has(c));
  // Anything else (still accessible via /knowledge)
  return curated;
}

function walkMdFiles(dirAbs: string, relBase = "", out: string[] = []): string[] {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const abs = path.join(dirAbs, e.name);
    const rel = relBase ? path.join(relBase, e.name) : e.name;

    if (e.isDirectory()) {
      walkMdFiles(abs, rel, out);
    } else if (e.isFile()) {
      const lower = e.name.toLowerCase();
      if (lower.endsWith(".md") || lower.endsWith(".markdown")) out.push(rel);
    }
  }
  return out;
}

export function listKnowledgeMarkdown(category: string): string[] {
  if (!isSafeSegment(category)) return [];
  const catDir = path.join(KNOWLEDGE_ROOT, category);
  try {
    if (!fs.existsSync(catDir) || !fs.statSync(catDir).isDirectory()) return [];
    return walkMdFiles(catDir).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function resolveKnowledgeMarkdownPath(category: string, relPath: string): string | null {
  if (!isSafeSegment(category)) return null;
  // relPath can contain subfolders, but must not traverse.
  const cleaned = relPath.replace(/\\/g, "/");
  if (!cleaned || cleaned.includes("..")) return null;

  const abs = path.join(KNOWLEDGE_ROOT, category, cleaned);
  // ensure abs is under category root
  const catRoot = path.join(KNOWLEDGE_ROOT, category) + path.sep;
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(path.resolve(catRoot))) return null;

  return resolved;
}

export function knowledgeMarkdownMtime(category: string, relPath: string): number | null {
  const resolved = resolveKnowledgeMarkdownPath(category, relPath);
  if (!resolved) return null;

  try {
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
    return fs.statSync(resolved).mtimeMs;
  } catch {
    return null;
  }
}

export function readKnowledgeMarkdown(category: string, relPath: string): string | null {
  const resolved = resolveKnowledgeMarkdownPath(category, relPath);
  if (!resolved) return null;

  try {
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
    return fs.readFileSync(resolved, "utf8");
  } catch {
    return null;
  }
}

export function titleFromRelPath(relPath: string): string {
  const base = relPath.split(/[\\/]/).pop() ?? relPath;
  const noExt = base.replace(/\.(md|markdown)$/i, "");
  return noExt
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
