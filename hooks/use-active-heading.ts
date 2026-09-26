"use client";

import { useEffect, useState } from "react";

/**
 * Report which heading is currently active, for a table of contents highlight.
 *
 * An `IntersectionObserver` watches the ids that exist in the DOM. When several headings are
 * visible, the topmost in document order wins, so the highlight does not flicker as one heading
 * leaves and the next enters. Ids that are not in the DOM are ignored, and every observer is
 * disconnected on unmount and whenever the id set changes.
 *
 * `revision` is for a caller that re-renders its body into the same ids. The reading surface writes
 * the document with `dangerouslySetInnerHTML`, so a content change replaces the heading elements
 * even when the heading set is identical; the observer would otherwise keep watching nodes that are
 * no longer in the document and the highlight would freeze. Pass anything that changes with the
 * content, such as the rendered html.
 *
 * This hook never scrolls. Reduced motion is the caller's decision; `scrollIntoView` is not called
 * here, the hook only reports what is active.
 */
export function useActiveHeading(
  ids: string[],
  options?: { rootMargin?: string; revision?: string | number }
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const rootMargin = options?.rootMargin;
  const revision = options?.revision ?? "";
  // Join keeps the effect stable when the caller passes a fresh array of the same ids.
  const idsKey = ids.join("\u0000");

  useEffect(() => {
    if (typeof document === "undefined" || typeof IntersectionObserver === "undefined") return;

    const currentIds = idsKey === "" ? [] : idsKey.split("\u0000");
    const elements = currentIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) {
      setActiveId(null);
      return;
    }

    const orderedIds = [...elements]
      .sort((first, second) =>
        first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      )
      .map((element) => element.id);
    const valid = new Set(orderedIds);
    const visible = new Set<string>();

    // Drop a highlight that points at a heading no longer observed; keep a still-valid one.
    setActiveId((current) => (current !== null && valid.has(current) ? current : null));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visible.add(id);
          } else {
            visible.delete(id);
          }
        }

        const topmost = orderedIds.find((id) => visible.has(id)) ?? null;
        // Keep the previous heading while none is visible, so the highlight does not drop out
        // between two widely spaced headings. Before anything is visible it stays null.
        setActiveId((current) => topmost ?? current);
      },
      { rootMargin: rootMargin ?? "0px 0px -70% 0px", threshold: 0 }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [idsKey, rootMargin, revision]);

  return activeId;
}
