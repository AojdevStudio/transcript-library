import { NextResponse } from "next/server";
import { listChannels } from "@/modules/catalog";
import { requirePrivateApi } from "@/lib/private-api-guard";

export const runtime = "nodejs";

/**
 * GET /api/channels
 * Returns all channels derived from the SQLite-backed transcript catalog.
 *
 * @returns JSON `{ channels }` — an array of channel name strings.
 */
export async function GET(req: Request) {
  const guard = requirePrivateApi(req);
  if (!guard.allowed) return guard.response;

  const channels = listChannels();
  return NextResponse.json({ channels });
}
