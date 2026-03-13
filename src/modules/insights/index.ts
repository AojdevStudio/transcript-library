/**
 * Owns insight-file discovery, reads, and preview generation.
 *
 * @module insights
 * @see module:lib/insights
 * @remarks
 * Side effects: reads insight files from local filesystem.
 * Error behavior: returns fallback/none values on missing files.
 */
export {
  getInsightArtifacts,
  hasBlockedLegacyInsight,
  hasInsight,
  isLegacyInsightFallbackAllowed,
  insightPaths,
  makePreview,
  readCuratedInsight,
  readInsightMigrationStatus,
  readInsightLogTail,
  readInsightMarkdown,
  readRunMetadata,
} from "@/lib/insights";
