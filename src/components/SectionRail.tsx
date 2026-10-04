"use client";

import { useEffect, useState } from "react";
import s from "./rail.module.css";

type Item = { el: HTMLElement; label: string };

/** A rail of dots on the page's far edge, one per [data-section], with the current one filled.
 *  It answers the mentors' "nothing says there is more below" and doubles as a table of contents. */
export function SectionRail({ label }: { label: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const found = [...document.querySelectorAll<HTMLElement>("[data-section]")].map((el) => {
      const heading = el.getAttribute("aria-labelledby");
      const h = heading ? document.getElementById(heading) : null;
      const text = h?.getAttribute("aria-label") ?? h?.querySelector("[aria-label]")?.getAttribute("aria-label") ?? h?.textContent ?? "";
      return { el, label: text.trim().replace(/\s+/g, " ").slice(0, 48) };
    });
    // Collected once, after mount, from the server-rendered sections.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(found);
    const onScroll = () => {
      const mid = window.innerHeight * 0.4;
      let idx = 0;
      found.forEach((it, i) => {
        if (it.el.getBoundingClientRect().top <= mid) idx = i;
      });
      setCurrent(idx);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (items.length < 2) return null;
  const go = (i: number) => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: items[i].el.getBoundingClientRect().top + window.scrollY, behavior: smooth ? "smooth" : "auto" });
  };
  const last = current === items.length - 1;

  return (
    <nav className={s.rail} aria-label={label}>
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            <button type="button" aria-current={i === current ? "true" : undefined} onClick={() => go(i)}>
              <span className={s.dot} aria-hidden />
              <span className={s.tip}>{it.label}</span>
            </button>
          </li>
        ))}
      </ol>
      {!last && (
        <button type="button" className={s.next} onClick={() => go(current + 1)} aria-label={items[current + 1]?.label}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </nav>
  );
}
