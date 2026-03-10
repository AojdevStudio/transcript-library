import { rebuildCatalogFromCsv } from "../src/lib/catalog-import";
import { catalogCsvPath } from "../src/lib/catalog";
import { catalogDbPath } from "../src/lib/catalog-db";

const args = new Set(process.argv.slice(2));

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
        csvPath: catalogCsvPath(),
        liveDbPath: catalogDbPath(),
        error: message,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
