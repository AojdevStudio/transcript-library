import { describe, expect, it } from "vitest";
import {
  COMPACT_SEARCH_INPUT_ID,
  getSearchShortcutAction,
  HERO_SEARCH_INPUT_ID,
  preferredSearchInputIds,
} from "@/lib/search-hotkeys";

describe("preferredSearchInputIds", () => {
  it("prefers the hero search input on the search page", () => {
    expect(preferredSearchInputIds("/search")).toEqual([
      HERO_SEARCH_INPUT_ID,
      COMPACT_SEARCH_INPUT_ID,
    ]);
  });

  it("prefers the compact header search input outside the search page", () => {
    expect(preferredSearchInputIds("/video/abc123xyz09")).toEqual([
      COMPACT_SEARCH_INPUT_ID,
      HERO_SEARCH_INPUT_ID,
    ]);
  });
});

describe("getSearchShortcutAction", () => {
  it("treats slash as focus-visible-search when the user is not typing", () => {
    expect(
      getSearchShortcutAction({
        key: "/",
        targetTagName: "BUTTON",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBe("focus-visible-search");
  });

  it("treats cmd or ctrl k as open-global-search", () => {
    expect(
      getSearchShortcutAction({
        key: "k",
        targetTagName: "DIV",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBe("open-global-search");
  });

  it("ignores shortcuts while focus is inside editable controls", () => {
    expect(
      getSearchShortcutAction({
        key: "/",
        targetTagName: "INPUT",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBeNull();

    expect(
      getSearchShortcutAction({
        key: "k",
        targetTagName: "DIV",
        isContentEditable: true,
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBeNull();
  });

  it("does not hijack ctrl or cmd shift k", () => {
    expect(
      getSearchShortcutAction({
        key: "k",
        targetTagName: "DIV",
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
      }),
    ).toBeNull();
  });
});
