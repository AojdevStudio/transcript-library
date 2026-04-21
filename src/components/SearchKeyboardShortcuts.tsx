"use client";

import { startTransition, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSearchShortcutAction, preferredSearchInputIds } from "@/lib/search-hotkeys";

function describeTarget(target: EventTarget | null): {
  targetTagName: string | null;
  isContentEditable: boolean;
} {
  if (!(target instanceof HTMLElement)) {
    return { targetTagName: null, isContentEditable: false };
  }

  return {
    targetTagName: target.tagName,
    isContentEditable:
      target.isContentEditable || target.closest("[contenteditable='true']") !== null,
  };
}

function focusVisibleSearchInput(pathname: string): boolean {
  for (const inputId of preferredSearchInputIds(pathname)) {
    const input = document.getElementById(inputId);
    if (!(input instanceof HTMLInputElement)) continue;
    if (input.getClientRects().length === 0) continue;

    input.focus();
    input.select();
    return true;
  }

  return false;
}

export function SearchKeyboardShortcuts() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const action = getSearchShortcutAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        ...describeTarget(event.target),
      });

      if (!action) return;

      event.preventDefault();

      if (action === "focus-visible-search") {
        focusVisibleSearchInput(pathname);
        return;
      }

      if (pathname.startsWith("/search")) {
        focusVisibleSearchInput(pathname);
        return;
      }

      startTransition(() => {
        router.push("/search");
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, router]);

  return null;
}
