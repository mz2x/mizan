"use client";

import { useState } from "react";
import { EXPORT_FORMATS, exportReview, type ExportFormat, type ExportModel } from "@/lib/export";
import type { Dictionary, Locale } from "@/lib/i18n";
import s from "./review.module.css";

/** «تصدير»: the review file as PDF, HTML (site design), Word, Excel, CSV or JSON, built in the browser. */
export function ExportMenu({ t, lang, model }: { t: Dictionary; lang: Locale; model: () => ExportModel }) {
  const r = t.review;
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  return (
    <details className={s.exportMenu}>
      <summary className="btn btn-sm">{r.exportLabel}</summary>
      <ul role="list">
        {EXPORT_FORMATS.map((f) => (
          <li key={f}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={async (e) => {
                // Read the menu before awaiting: React clears currentTarget once the handler yields.
                const menu = e.currentTarget.closest("details");
                setBusy(f);
                try {
                  await exportReview(model(), lang, f);
                } finally {
                  setBusy(null);
                  menu?.removeAttribute("open");
                }
              }}
            >
              <span>{r.exportFormats[f].name}</span>
              <small>{r.exportFormats[f].hint}</small>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
