import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bootstrapCatalogDb, catalogDbPath } from "@/lib/catalog-db";

const originalCatalogDbPath = process.env.CATALOG_DB_PATH;

afterEach(() => {
  if (originalCatalogDbPath === undefined) {
    delete process.env.CATALOG_DB_PATH;
  } else {
    process.env.CATALOG_DB_PATH = originalCatalogDbPath;
  }
});

describe("catalog-db bootstrap", () => {
  it("defaults the live catalog DB under the app-owned data directory", () => {
    delete process.env.CATALOG_DB_PATH;

    expect(catalogDbPath()).toBe(path.resolve(process.cwd(), "data", "catalog", "catalog.db"));
  });

  it("creates the catalog schema in a configured writable location", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-db-"));
    process.env.CATALOG_DB_PATH = path.join(tempRoot, "catalog", "catalog.db");

    const db = bootstrapCatalogDb();

    try {
      const tables = db
        .prepare(
          `
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name IN ('catalog_videos', 'catalog_parts')
            ORDER BY name
          `,
        )
        .all() as Array<{ name: string }>;

      expect(tables).toEqual([{ name: "catalog_parts" }, { name: "catalog_videos" }]);
      expect(fs.existsSync(process.env.CATALOG_DB_PATH)).toBe(true);
    } finally {
      db.close();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
