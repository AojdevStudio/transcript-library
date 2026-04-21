export const HERO_SEARCH_INPUT_ID = "search-hero";
export const COMPACT_SEARCH_INPUT_ID = "search-compact";

export type SearchShortcutAction = "focus-visible-search" | "open-global-search";

export type SearchShortcutDescriptor = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  targetTagName?: string | null;
  isContentEditable?: boolean;
};

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function preferredSearchInputIds(pathname: string): string[] {
  return pathname.startsWith("/search")
    ? [HERO_SEARCH_INPUT_ID, COMPACT_SEARCH_INPUT_ID]
    : [COMPACT_SEARCH_INPUT_ID, HERO_SEARCH_INPUT_ID];
}

export function getSearchShortcutAction(
  descriptor: SearchShortcutDescriptor,
): SearchShortcutAction | null {
  const tagName = (descriptor.targetTagName ?? "").toUpperCase();
  if (descriptor.isContentEditable || EDITABLE_TAGS.has(tagName)) return null;

  if (descriptor.key === "/" && !descriptor.metaKey && !descriptor.ctrlKey && !descriptor.altKey) {
    return "focus-visible-search";
  }

  if (
    descriptor.key.toLowerCase() === "k" &&
    (descriptor.metaKey || descriptor.ctrlKey) &&
    !descriptor.altKey &&
    !descriptor.shiftKey
  ) {
    return "open-global-search";
  }

  return null;
}
