import { NextResponse } from "next/server";
import fs from "node:fs";
import crypto from "node:crypto";
import { groupVideos, absTranscriptPath } from "@/lib/catalog";
import {
  readStatus,
  isProcessAlive,
  analysisPath,
  spawnAnalysis,
} from "@/lib/analysis";

export const runtime = "nodejs";

function validateBearerToken(req: Request, expectedToken: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  // HMAC both values to fixed-length buffers for fully constant-time comparison
  const provided = crypto.createHmac("sha256", "sync-hook-compare").update(match[1]).digest();
  const expected = crypto.createHmac("sha256", "sync-hook-compare").update(expectedToken).digest();
  return crypto.timingSafeEqual(provided, expected);
}

export async function POST(req: Request) {
  const syncToken = process.env.SYNC_TOKEN;
  if (!syncToken) {
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }

  if (!validateBearerToken(req, syncToken)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const videos = Array.from(groupVideos().values());

  // Find un-analyzed videos
  const unanalyzed = videos.filter((v) => {
    // Skip if analysis.md already exists
    try {
      fs.accessSync(analysisPath(v.videoId));
      return false;
    } catch {
      // No analysis yet — candidate for processing
    }

    // Skip if currently running
    const st = readStatus(v.videoId);
    if (st?.status === "running" && isProcessAlive(st.pid)) {
      return false;
    }

    return true;
  });

  // Spawn what fits within concurrency cap, report honestly
  let started = 0;
  let skipped = 0;

  for (const video of unanalyzed) {
    const transcriptParts = video.parts.map((p) => {
      const abs = absTranscriptPath(p.filePath);
      try {
        return fs.readFileSync(abs, "utf8");
      } catch {
        return `[Part ${p.chunk}: file not found]`;
      }
    });
    const transcript = transcriptParts.join("\n\n---\n\n");

    const spawned = spawnAnalysis(
      video.videoId,
      { title: video.title, channel: video.channel, topic: video.topic, publishedDate: video.publishedDate },
      transcript,
      "[sync-hook]",
    );

    if (spawned) {
      started++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    message: "analysis triggered",
    started,
    skipped,
    total: unanalyzed.length,
  });
}
