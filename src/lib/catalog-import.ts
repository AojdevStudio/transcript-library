import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { VideoRow } from "./catalog.ts";
import { catalogCsvPath } from "./catalog.ts";
import { bootstrapCatalogDb, catalogDbPath, type CatalogDatabase } from "./catalog-db.ts";

const UNKNOWN_CHANNEL = "(unknown channel)";
const UNKNOWN_TOPIC = "(uncategorized)";
const UNKNOWN_DATE = "0000-00-00";

type CatalogPartRecord = {
  chunkIndex: number;
  filePath: string;
  wordCount: number;
};

type CatalogVideoRecord = {
  videoId: string;
  title: string;
  channel: string;
  topic: string;
  publishedDate: string;
  ingestedDate: string;
  totalChunks: number;
  sourceRowCount: number;
  parts: CatalogPartRecord[];
};

export type CatalogRebuildResult = {
  csvPath: string;
  liveDbPath: string;
  tempDbPath: string;
  validationReportPath: string;
  catalogVersion: string;
  videoCount: number;
  partCount: number;
  checkOnly: boolean;
};

export type CatalogValidationReport = {
  schemaVersion: 1;
  generatedAt: string;
  csvPath: string;
  liveDbPath: string;
  tempDbPath: string;
  validationReportPath: string;
  catalogVersion: string;
  checkOnly: boolean;
  valid: boolean;
  summary: {
    videoCount: number;
    partCount: number;
    malformedRowCount: number;
    missingCanonicalVideoIds: string[];
    orderingMismatchVideoIds: string[];
  };
  parity: {
    canonicalVideoCountMatches: boolean;
    transcriptPartCountMatches: boolean;
  };
  malformedRows: Array<{
    rowNumber: number;
    videoId: string;
    issue: string;
  }>;
  orderingMismatches: Array<{
    videoId: string;
    expectedChunkOrder: number[];
    persistedChunkOrder: number[];
  }>;
  errors: string[];
};

type CatalogValidationContext = {
  csvPath: string;
  liveDbPath: string;
  tempDbPath: string;
  validationReportPath: string;
  catalogVersion: string;
  checkOnly: boolean;
};

type PersistedPartParity = {
  video_id: string;
  chunk_index: number;
  file_path: string;
};

type CatalogValidationMetrics = {
  videoCount: number;
  partCount: number;
  malformedRows: CatalogValidationReport["malformedRows"];
  missingCanonicalVideoIds: string[];
  orderingMismatches: CatalogValidationReport["orderingMismatches"];
};

function splitCatalogLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  out.push(current);
  return out;
}

function readCatalogRows(csvFilePath: string): VideoRow[] {
  const raw = fs.readFileSync(csvFilePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  if (lines.length === 0) {
    throw new Error(`Catalog CSV is empty: ${csvFilePath}`);
  }

  const header = splitCatalogLine(lines[0]);
  const indexByHeader = Object.fromEntries(header.map((value, index) => [value, index] as const));

  const requiredHeaders = [
    "video_id",
    "parent_video_id",
    "title",
    "channel",
    "topic",
    "published_date",
    "ingested_date",
    "word_count",
    "chunk",
    "total_chunks",
    "file_path",
  ] as const;

  for (const requiredHeader of requiredHeaders) {
    if (!(requiredHeader in indexByHeader)) {
      throw new Error(`Catalog CSV missing required column: ${requiredHeader}`);
    }
  }

  return lines.slice(1).map((line) => {
    const columns = splitCatalogLine(line);

    return {
      video_id: columns[indexByHeader.video_id] ?? "",
      parent_video_id: columns[indexByHeader.parent_video_id] ?? "",
      title: columns[indexByHeader.title] ?? "",
      channel: columns[indexByHeader.channel] ?? "",
      topic: columns[indexByHeader.topic] ?? "",
      published_date: columns[indexByHeader.published_date] ?? "",
      ingested_date: columns[indexByHeader.ingested_date] ?? "",
      word_count: columns[indexByHeader.word_count] ?? "",
      chunk: columns[indexByHeader.chunk] ?? "",
      total_chunks: columns[indexByHeader.total_chunks] ?? "",
      file_path: columns[indexByHeader.file_path] ?? "",
    };
  });
}

function integerField(value: string, name: string, videoId: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Catalog row for ${videoId} has invalid ${name}: ${value || "<blank>"}`);
  }
  return parsed;
}

function chunkIndexForRow(row: VideoRow, videoId: string, rowCount: number): number {
  if (!row.chunk.trim() && rowCount === 1) {
    return 1;
  }

  return integerField(row.chunk, "chunk index", videoId);
}

function declaredTotalChunksForGroup(
  canonicalRow: VideoRow,
  videoId: string,
  rowCount: number,
): number {
  if (!canonicalRow.total_chunks.trim()) {
    return rowCount;
  }

  return integerField(canonicalRow.total_chunks, "total chunks", videoId);
}

function normalizeText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function canonicalVideoId(row: VideoRow): string {
  return row.parent_video_id.trim() || row.video_id.trim();
}

function catalogValidationReportPath(liveDbFilePath = catalogDbPath()): string {
  return path.join(path.dirname(liveDbFilePath), "last-import-validation.json");
}

function detectMalformedRows(rows: VideoRow[]): {
  malformedRows: CatalogValidationReport["malformedRows"];
  missingCanonicalVideoIds: string[];
} {
  const malformedRows: CatalogValidationReport["malformedRows"] = [];
  const missingCanonicalVideoIds: string[] = [];

  rows.forEach((row, index) => {
    const videoId = canonicalVideoId(row);
    const rowNumber = index + 2;

    if (!videoId) {
      missingCanonicalVideoIds.push(`row-${rowNumber}`);
      malformedRows.push({
        rowNumber,
        videoId: "<missing>",
        issue: "missing canonical video id",
      });
      return;
    }

    if (!row.file_path.trim()) {
      malformedRows.push({
        rowNumber,
        videoId,
        issue: "missing transcript file path",
      });
    }

    if (row.chunk.trim()) {
      const chunkIndex = Number.parseInt(row.chunk, 10);
      if (!Number.isInteger(chunkIndex) || chunkIndex <= 0) {
        malformedRows.push({
          rowNumber,
          videoId,
          issue: `invalid chunk index: ${row.chunk || "<blank>"}`,
        });
      }
    }

    const wordCount = Number.parseInt(row.word_count, 10);
    if (!Number.isInteger(wordCount) || wordCount <= 0) {
      malformedRows.push({
        rowNumber,
        videoId,
        issue: `invalid word count: ${row.word_count || "<blank>"}`,
      });
    }
  });

  return { malformedRows, missingCanonicalVideoIds };
}

function normalizeVideoRecord(videoId: string, rows: VideoRow[]): CatalogVideoRecord {
  const duplicateSinglePartRows = rows.every(
    (row) => !row.chunk.trim() && !row.total_chunks.trim(),
  );
  // Canonical metadata comes from the earliest ordered transcript row so import-time choices stay deterministic.
  const orderedRows = [...rows].sort((left, right) => {
    if (!duplicateSinglePartRows) {
      const chunkDelta =
        chunkIndexForRow(left, videoId, rows.length) -
        chunkIndexForRow(right, videoId, rows.length);
      if (chunkDelta !== 0) {
        return chunkDelta;
      }
    }

    return left.file_path.localeCompare(right.file_path);
  });
  const rowsForParts = duplicateSinglePartRows ? [orderedRows[0]] : orderedRows;

  const chunkSet = new Set<number>();
  const parts: CatalogPartRecord[] = [];
  for (const row of rowsForParts) {
    const filePath = row.file_path.trim();
    if (!filePath) {
      throw new Error(`Catalog row for ${videoId} is missing a transcript file path`);
    }

    const chunkIndex = duplicateSinglePartRows
      ? 1
      : chunkIndexForRow(row, videoId, orderedRows.length);
    if (chunkSet.has(chunkIndex)) {
      continue;
    }
    chunkSet.add(chunkIndex);

    parts.push({
      chunkIndex,
      filePath,
      wordCount: integerField(row.word_count || "0", "word count", videoId),
    });
  }

  const canonicalRow = orderedRows[0];
  const declaredTotalChunks = duplicateSinglePartRows
    ? 1
    : declaredTotalChunksForGroup(canonicalRow, videoId, orderedRows.length);
  if (declaredTotalChunks !== parts.length) {
    throw new Error(
      `Catalog row group for ${videoId} expected ${declaredTotalChunks} parts but imported ${parts.length}`,
    );
  }

  return {
    videoId,
    title: normalizeText(canonicalRow.title, `Untitled video ${videoId}`),
    channel: normalizeText(canonicalRow.channel, UNKNOWN_CHANNEL),
    topic: normalizeText(canonicalRow.topic, UNKNOWN_TOPIC),
    publishedDate: normalizeText(canonicalRow.published_date, UNKNOWN_DATE),
    ingestedDate: normalizeText(canonicalRow.ingested_date, UNKNOWN_DATE),
    totalChunks: parts.length,
    sourceRowCount: orderedRows.length,
    parts,
  };
}

function buildVideoRecords(rows: VideoRow[]): CatalogVideoRecord[] {
  const groupedRows = new Map<string, VideoRow[]>();

  for (const row of rows) {
    const videoId = canonicalVideoId(row);
    if (!videoId) {
      throw new Error("Catalog row is missing canonical video id");
    }

    const group = groupedRows.get(videoId);
    if (group) {
      group.push(row);
    } else {
      groupedRows.set(videoId, [row]);
    }
  }

  return Array.from(groupedRows.entries())
    .map(([videoId, videoRows]) => normalizeVideoRecord(videoId, videoRows))
    .sort((left, right) => left.videoId.localeCompare(right.videoId));
}

function writeSnapshot(db: CatalogDatabase, records: CatalogVideoRecord[]): void {
  db.exec("DELETE FROM catalog_parts; DELETE FROM catalog_videos;");

  const insertVideo = db.prepare(`
    INSERT INTO catalog_videos (
      video_id,
      title,
      channel,
      topic,
      published_date,
      ingested_date,
      total_chunks,
      source_row_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPart = db.prepare(`
    INSERT INTO catalog_parts (
      video_id,
      chunk_index,
      word_count,
      file_path
    ) VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction((catalogRecords: CatalogVideoRecord[]) => {
    for (const record of catalogRecords) {
      insertVideo.run(
        record.videoId,
        record.title,
        record.channel,
        record.topic,
        record.publishedDate,
        record.ingestedDate,
        record.totalChunks,
        record.sourceRowCount,
      );

      for (const part of record.parts) {
        insertPart.run(record.videoId, part.chunkIndex, part.wordCount, part.filePath);
      }
    }
  });

  transaction(records);
}

function validateSnapshot(
  db: CatalogDatabase,
  records: CatalogVideoRecord[],
  malformedRows: CatalogValidationReport["malformedRows"],
  missingCanonicalVideoIds: string[],
): CatalogValidationMetrics {
  const videoCount =
    (db.prepare("SELECT COUNT(*) AS count FROM catalog_videos").get() as { count: number }).count ??
    0;
  const partCount =
    (db.prepare("SELECT COUNT(*) AS count FROM catalog_parts").get() as { count: number }).count ??
    0;
  const expectedPartCount = records.reduce((total, record) => total + record.parts.length, 0);
  const orderingMismatches: CatalogValidationReport["orderingMismatches"] = [];

  if (videoCount !== records.length) {
    throw new Error(
      `Catalog parity check failed: expected ${records.length} videos but found ${videoCount}`,
    );
  }

  if (partCount !== expectedPartCount) {
    throw new Error(
      `Catalog parity check failed: expected ${expectedPartCount} parts but found ${partCount}`,
    );
  }

  for (const record of records) {
    const persistedParts = db
      .prepare(
        `
          SELECT chunk_index, file_path
          FROM catalog_parts
          WHERE video_id = ?
          ORDER BY chunk_index ASC
        `,
      )
      .all(record.videoId) as PersistedPartParity[];

    const expectedParts = record.parts.map((part) => ({
      chunk_index: part.chunkIndex,
      file_path: part.filePath,
    }));

    if (JSON.stringify(persistedParts) !== JSON.stringify(expectedParts)) {
      orderingMismatches.push({
        videoId: record.videoId,
        expectedChunkOrder: expectedParts.map((part) => part.chunk_index),
        persistedChunkOrder: persistedParts.map((part) => part.chunk_index),
      });
      throw new Error(
        `Catalog parity check failed: transcript parts drifted for ${record.videoId}`,
      );
    }
  }

  return {
    videoCount,
    partCount,
    malformedRows,
    missingCanonicalVideoIds,
    orderingMismatches,
  };
}

function tempSnapshotPath(liveDbFilePath: string): string {
  const directory = path.dirname(liveDbFilePath);
  const basename = path.basename(liveDbFilePath);
  return path.join(directory, `${basename}.tmp-${crypto.randomBytes(6).toString("hex")}`);
}

function buildCatalogVersion(records: CatalogVideoRecord[]): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        records.map((record) => ({
          videoId: record.videoId,
          title: record.title,
          channel: record.channel,
          topic: record.topic,
          publishedDate: record.publishedDate,
          ingestedDate: record.ingestedDate,
          totalChunks: record.totalChunks,
          sourceRowCount: record.sourceRowCount,
          parts: record.parts,
        })),
      ),
    )
    .digest("hex");
}

function buildCatalogVersionFromRows(rows: VideoRow[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function writeValidationReport(
  context: CatalogValidationContext,
  metrics: CatalogValidationMetrics,
  errors: string[],
): CatalogValidationReport {
  const report: CatalogValidationReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    csvPath: context.csvPath,
    liveDbPath: context.liveDbPath,
    tempDbPath: context.tempDbPath,
    validationReportPath: context.validationReportPath,
    catalogVersion: context.catalogVersion,
    checkOnly: context.checkOnly,
    valid: errors.length === 0,
    summary: {
      videoCount: metrics.videoCount,
      partCount: metrics.partCount,
      malformedRowCount: metrics.malformedRows.length,
      missingCanonicalVideoIds: metrics.missingCanonicalVideoIds,
      orderingMismatchVideoIds: metrics.orderingMismatches.map((item) => item.videoId),
    },
    parity: {
      canonicalVideoCountMatches: !errors.some(
        (error) => error.includes("expected") && error.includes("videos"),
      ),
      transcriptPartCountMatches: !errors.some(
        (error) => error.includes("expected") && error.includes("parts"),
      ),
    },
    malformedRows: metrics.malformedRows,
    orderingMismatches: metrics.orderingMismatches,
    errors,
  };

  fs.mkdirSync(path.dirname(context.validationReportPath), { recursive: true });
  fs.writeFileSync(context.validationReportPath, JSON.stringify(report, null, 2));
  return report;
}

export function rebuildCatalogFromCsv(options?: {
  csvPath?: string;
  liveDbPath?: string;
  checkOnly?: boolean;
}): CatalogRebuildResult {
  const csvPath = options?.csvPath ?? catalogCsvPath();
  const liveDbFilePath = options?.liveDbPath ?? catalogDbPath();
  const tempDbPath = tempSnapshotPath(liveDbFilePath);
  const validationReportPath = catalogValidationReportPath(liveDbFilePath);
  const rows = readCatalogRows(csvPath);
  const { malformedRows, missingCanonicalVideoIds } = detectMalformedRows(rows);
  let records: CatalogVideoRecord[] = [];
  let catalogVersion = buildCatalogVersionFromRows(rows);
  let db: CatalogDatabase | undefined;
  const context: CatalogValidationContext = {
    csvPath,
    liveDbPath: liveDbFilePath,
    tempDbPath,
    validationReportPath,
    catalogVersion,
    checkOnly: options?.checkOnly ?? false,
  };

  try {
    records = buildVideoRecords(rows);
    catalogVersion = buildCatalogVersion(records);
    context.catalogVersion = catalogVersion;
    db = bootstrapCatalogDb(tempDbPath);
    writeSnapshot(db, records);
    const counts = validateSnapshot(db, records, malformedRows, missingCanonicalVideoIds);
    writeValidationReport(context, counts, []);
    db.close();
    db = undefined;

    if (options?.checkOnly) {
      fs.rmSync(tempDbPath, { force: true });
    } else {
      // Publish only a fully validated snapshot so failed rebuilds never disturb the live catalog.
      fs.mkdirSync(path.dirname(liveDbFilePath), { recursive: true });
      fs.renameSync(tempDbPath, liveDbFilePath);
    }

    return {
      csvPath,
      liveDbPath: liveDbFilePath,
      tempDbPath,
      validationReportPath,
      catalogVersion,
      videoCount: counts.videoCount,
      partCount: counts.partCount,
      checkOnly: options?.checkOnly ?? false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeValidationReport(
      context,
      {
        videoCount: 0,
        partCount: 0,
        malformedRows,
        missingCanonicalVideoIds,
        orderingMismatches: [],
      },
      [message],
    );
    try {
      db?.close();
    } catch {}
    fs.rmSync(tempDbPath, { force: true });
    throw error;
  }
}

export { catalogValidationReportPath };
