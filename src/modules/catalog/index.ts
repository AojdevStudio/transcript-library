/**
 * Owns transcript video catalog loading/grouping and channel/video lookups.
 *
 * @module catalog
 * @see module:lib/catalog
 * @remarks
 * Side effects: reads SQLite snapshot metadata and transcript files from disk.
 * Error behavior: throws on unexpected fs/path failures.
 */
export {
  groupVideos,
  listChannels,
  listVideosByChannel,
  getVideo,
  absTranscriptPath,
  type VideoRow,
  type Video,
  type ChannelSummary,
} from "@/lib/catalog";
