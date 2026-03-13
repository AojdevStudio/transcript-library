/**
 * Private API boundary guard.
 *
 * Provides a single reusable policy for protecting internal API routes.
 * The guard checks `Authorization: Bearer <token>` against PRIVATE_API_TOKEN.
 *
 * Behavior by environment:
 * - **Hosted** (`HOSTED=true`): Requests without a valid token are rejected 401.
 * - **Local dev** (`HOSTED` unset): The guard passes all requests through so
 *   local browsing works without any token configuration.
 *
 * The SYNC_TOKEN used by `/api/sync-hook` is treated as a specialization:
 * sync-hook checks SYNC_TOKEN directly (its existing behavior), but
 * PRIVATE_API_TOKEN is accepted as a universal override for any guarded route.
 *
 * Response sanitization strips internal details (filesystem paths, provider
 * names, raw error stacks) from hosted responses.
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { isHosted } from "@/lib/hosted-config";

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

/**
 * Constant-time comparison of bearer token against expected value.
 */
function validateBearer(req: Request, expectedToken: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const provided = crypto.createHmac("sha256", "private-api-guard").update(match[1]).digest();
  const expected = crypto.createHmac("sha256", "private-api-guard").update(expectedToken).digest();
  return crypto.timingSafeEqual(provided, expected);
}

// ---------------------------------------------------------------------------
// Guard result type
// ---------------------------------------------------------------------------

export type GuardResult =
  | { allowed: true; reason: "local-dev" | "valid-token" }
  | { allowed: false; response: NextResponse };

// ---------------------------------------------------------------------------
// Main guard
// ---------------------------------------------------------------------------

/**
 * Checks the request against the private API boundary policy.
 *
 * Returns `{ allowed: true }` if the request should proceed, or
 * `{ allowed: false, response }` with a ready-to-return 401/503 response.
 *
 * Usage in a route handler:
 * ```ts
 * const guard = requirePrivateApi(req);
 * if (!guard.allowed) return guard.response;
 * // ... handle request
 * ```
 */
export function requirePrivateApi(req: Request): GuardResult {
  // In local dev, allow everything — no token needed.
  if (!isHosted()) {
    return { allowed: true, reason: "local-dev" };
  }

  const token = process.env.PRIVATE_API_TOKEN;
  if (!token) {
    // Should not happen if preflight passed, but defend in depth.
    return {
      allowed: false,
      response: NextResponse.json(
        { ok: false, error: "private API not configured" },
        { status: 503 },
      ),
    };
  }

  if (validateBearer(req, token)) {
    return { allowed: true, reason: "valid-token" };
  }

  return {
    allowed: false,
    response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
  };
}

// ---------------------------------------------------------------------------
// Response sanitization
// ---------------------------------------------------------------------------

/** Fields to strip from API responses in hosted mode. */
const SENSITIVE_KEYS = new Set([
  "absPath",
  "transcriptPartPath",
  "filePath",
  "resolvedPath",
  "insightsDir",
  "artifactPath",
  "provider",
  "providerModel",
  "command",
  "workerPid",
  "remoteAddress",
]);

/**
 * Recursively removes sensitive keys from a JSON-serializable value.
 * Only active in hosted mode — in local dev, returns the input unchanged.
 */
export function sanitizePayload<T>(value: T): T {
  if (!isHosted()) return value;
  return deepStrip(value) as T;
}

function deepStrip(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deepStrip);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      out[k] = deepStrip(v);
    }
    return out;
  }
  return value;
}
