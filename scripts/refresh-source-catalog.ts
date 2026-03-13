import fs from "node:fs";
import path from "node:path";
import { refreshSourceCatalog, sourceRefreshRecordPath } from "../src/lib/source-refresh.ts";

const args = new Set(process.argv.slice(2));

function loadLocalEnvDefaults() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, value] = match;
    if (process.env[key] !== undefined) {
      continue;
    }

    let normalized = value.trim();
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      normalized = normalized.slice(1, -1);
    }

    process.env[key] = normalized;
  }
}

loadLocalEnvDefaults();

const result = refreshSourceCatalog({
  trigger: "cli",
  checkOnly: args.has("--check"),
});

const payload = {
  status: result.outcome,
  phase: result.phase,
  trigger: result.trigger,
  checkOnly: result.catalog.checkOnly,
  request: result.request ?? null,
  repo: result.repo,
  catalog: result.catalog,
  error: result.error ?? null,
  recordPath: sourceRefreshRecordPath(),
};

if (result.outcome === "failed") {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
