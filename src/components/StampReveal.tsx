"use client";

import { useEffect } from "react";

/**
 * Arms every [data-stamp] below the fold, then presses it when it scrolls into view.
 * Stamps start visible in the HTML; they are hidden only once this runs, and a timeout
 * presses anything the observer never reports, so nothing can stay invisible.
 */
export function StampReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stamps = [...document.querySelectorAll<HTMLElement>("[data-stamp]")].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    );
    stamps.forEach((el) => el.setAttribute("data-armed", ""));

    const press = (el: Element) => el.setAttribute("data-inview", "");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            press(e.target);
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -18% 0px" },
    );
    stamps.forEach((el) => io.observe(el));
    const fallback = window.setTimeout(() => stamps.forEach(press), 12000);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return null;
}
