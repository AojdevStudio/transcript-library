import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type CatalogDatabase = Database.Database;

export function catalogDbPath(): string {
  const configured = process.env.CATALOG_DB_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  return path.resolve(process.cwd(), "data", "catalog", "catalog.db");
}

export function openCatalogDb(filePath = catalogDbPath()): CatalogDatabase {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  // Keep the catalog snapshot as a single file so rebuilds can publish via one atomic rename.
  db.pragma("journal_mode = DELETE");
  db.pragma("foreign_keys = ON");
  return db;
}

export function ensureCatalogSchema(db: CatalogDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_videos (
      video_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      channel TEXT NOT NULL,
      topic TEXT NOT NULL,
      published_date TEXT NOT NULL,
      ingested_date TEXT NOT NULL,
      total_chunks INTEGER NOT NULL,
      source_row_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_parts (
      video_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      word_count INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      PRIMARY KEY (video_id, chunk_index),
      FOREIGN KEY (video_id) REFERENCES catalog_videos(video_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_videos_channel_published
      ON catalog_videos(channel, published_date DESC, video_id);

    CREATE INDEX IF NOT EXISTS idx_catalog_videos_published_channel
      ON catalog_videos(published_date DESC, channel, video_id);

    CREATE INDEX IF NOT EXISTS idx_catalog_parts_video_chunk
      ON catalog_parts(video_id, chunk_index);
  `);
}

export function bootstrapCatalogDb(filePath = catalogDbPath()): CatalogDatabase {
  const db = openCatalogDb(filePath);
  ensureCatalogSchema(db);
  return db;
}
