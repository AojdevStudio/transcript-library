import { rebuildCatalogFromCsv } from "../src/lib/catalog-import.ts";
import { catalogCsvPath } from "../src/lib/catalog.ts";
import { catalogDbPath } from "../src/lib/catalog-db.ts";

const args = new Set(process.argv.slice(2));

function safeCatalogCsvPath(): string | undefined {
  try {
    return catalogCsvPath();
  } catch {
    return undefined;
  }
}

function safeCatalogDbPath(): string | undefined {
  try {
    return catalogDbPath();
  } catch {
    return undefined;
  }
}

try {
  const result = rebuildCatalogFromCsv({
    checkOnly: args.has("--check"),
  });

  console.log(
    JSON.stringify(
      {
        status: args.has("--check") ? "validated" : "rebuilt",
        csvPath: result.csvPath,
        liveDbPath: result.liveDbPath,
        validationReportPath: result.validationReportPath,
        catalogVersion: result.catalogVersion,
        videoCount: result.videoCount,
        partCount: result.partCount,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify(
      {
        status: "failed",
        csvPath: safeCatalogCsvPath(),
        liveDbPath: safeCatalogDbPath(),
        error: message,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
