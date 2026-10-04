"use client";

import { useEffect } from "react";

/** Presenter mode for the projector: arrow keys and Page Up/Down step between sections. */
export function Presenter() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const forward = ["ArrowDown", "PageDown", "ArrowLeft"].includes(e.key);
      const back = ["ArrowUp", "PageUp", "ArrowRight"].includes(e.key);
      if (!forward && !back) return;

      const sections = [...document.querySelectorAll<HTMLElement>("[data-section]")];
      const y = window.scrollY + 4;
      const tops = sections.map((el) => el.getBoundingClientRect().top + window.scrollY);
      const next = forward ? tops.find((top) => top > y + 8) : [...tops].reverse().find((top) => top < y - 8);
      if (next === undefined) return;

      e.preventDefault();
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: next, behavior: smooth ? "smooth" : "auto" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
