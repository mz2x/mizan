"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
import { DEMO_CONTRACT } from "@/content/contract";
import type { Verdict } from "@/content/demo";
import { PRIORITY, type L } from "@/lib/review-types";
import { IconArrow, IconUpload } from "@/components/icons";
import { AppBar } from "@/components/app/AppBar";
import { ClauseRow, type Row } from "./ClauseRow";
import { ExportMenu } from "./ExportMenu";
import { demoEngine, httpEngine, saveAccessCode, splitClauses, storedAccessCode } from "@/lib/engine";
import { localDigits } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import { contractId, runId } from "@/lib/ids";
import { localStore, pickStore, type AccountState, type RunStore } from "@/lib/run-store";
import { ENGINE_VERSION, layoutOf, storedClause, textHash, toClauseResult, flatText, type Folder, type StoredClause, type StoredRun } from "@/lib/runs";
import { FEATURES } from "@/lib/features";
import s from "./review.module.css";
import { localePath } from "@/lib/paths";
import { redact, type RedactKind } from "@/lib/redact";

type Phase = "intake" | "running" | "done" | "offline";
type Sort = "priority" | "order";
type Saved = { where: "remote" | "local"; fellBack: boolean } | null;

/** Each filter tile carries its state's mark: the same impression the register uses. */
const MARK: Record<Verdict, string> = {
  nonCompliant: "stamp-red",
  review: "stamp-bracket",
  abstain: "stamp-dashed",
  compliant: "stamp-round",
};

/** The demonstration contract's text as the engine receives it; its contract id comes from this. */
const DEMO_TEXT = DEMO_CONTRACT.clauses.map((c, i) => `${i + 1}- ${c.text.ar}`).join("\n");

export function ReviewApp({ t, lang }: { t: Dictionary; lang: Locale }) {
  const r = t.review;
  const [phase, setPhase] = useState<Phase>("intake");
  const [rows, setRows] = useState<Row[]>([]);
  const [docTitle, setDocTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  // The live engine is the only mode on screen. `?offline` keeps the recorded demo as a stage fallback.
  const live = !useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).has("offline"), () => false);
  const [isDemo, setIsDemo] = useState(false);
  const [liveRun, setLiveRun] = useState(false);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  // Privacy (report requirements 2–4): an uploaded or pasted text is shown masked, and sent only
  // after the reader confirms it holds no real individuals' data. The demo contract skips this.
  const [pending, setPending] = useState<{ text: string; title: string } | null>(null);
  const [ack, setAck] = useState(false);
  const preview = useMemo(() => (pending ? redact(pending.text) : null), [pending]);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<Verdict | "all">("all");
  const [sort, setSort] = useState<Sort>("priority");
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  // Access code: asked for only when the server needs one and none is saved here.
  const [hasCode, setHasCode] = useState(false);
  const [editCode, setEditCode] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  // Where results are saved: the account when signed in, otherwise this browser; or nowhere.
  const [account, setAccount] = useState<AccountState | null>(null);
  const [store, setStore] = useState<RunStore>(localStore);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [target, setTarget] = useState<string>("general");
  const [ids, setIds] = useState<{ contract: string; run: string } | null>(null);
  const [saved, setSaved] = useState<Saved>(null);
  const [lockedFrom, setLockedFrom] = useState<string | null>(null);
  const lastRun = useRef<{ input: { text: string } | { demo: true }; title: string } | null>(null);

  /** The latest saved live review of this exact text under this engine version, if any. */
  const findPrior = useCallback(
    async (contract: string, text: string): Promise<StoredRun | null> => {
      try {
        const { runs } = await store.list();
        const hash = await textHash(text);
        for (const sum of runs.filter((x) => x.contractId === contract && x.engine === "live")) {
          const full = await store.get(sum.id);
          if (full?.layout?.length && full.textHash === hash && full.engineVersion === ENGINE_VERSION) return full;
        }
      } catch {
        // No saved runs reachable: review afresh.
      }
      return null;
    },
    [store],
  );

  useEffect(() => {
    let alive = true;
    pickStore().then(async ({ store: st, state }) => {
      if (!alive) return;
      setAccount(state);
      setStore(st);
      setHasCode(Boolean(storedAccessCode()));
      const list = await st.list().catch(() => ({ folders: [] as Folder[] }));
      if (!alive) return;
      setFolders(list.folders);
      // A folder chosen in the dashboard (?folder=...) is preselected.
      const want = new URLSearchParams(window.location.search).get("folder");
      if (want && list.folders.some((f) => f.id === want)) setTarget(want);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Leaving the page stops an in-flight review (and its server-side pipeline).
  useEffect(() => () => abort.current?.abort(), []);

  const codeRequired = live && account?.codeRequired !== false;

  const save = useCallback(
    async (done: Row[], meta: { contract: string; run: string; title: string; engine: "live" | "offline"; demo: boolean; text: string; replayedFrom?: string }) => {
      if (target === "none" || !FEATURES.dashboard) return;
      const clauses = done.map(storedClause).filter((c): c is StoredClause => c !== null);
      if (clauses.length === 0) return;
      // Offsets and a hash, never text: lets a re-upload of the same contract replay this result.
      const layout = meta.engine === "live" ? layoutOf(meta.text, done) : null;
      const run = {
        id: meta.run,
        contractId: meta.contract,
        fileName: meta.title,
        createdAt: new Date().toISOString(),
        engine: meta.engine,
        demo: meta.demo,
        folderId: target === "general" ? null : target,
        clauses,
        decisions: {},
        audit: [{ at: new Date().toISOString(), kind: "reviewed" as const, detail: meta.replayedFrom ? `${meta.engine}:replay:${meta.replayedFrom}` : meta.engine }],
        textHash: layout ? await textHash(meta.text) : undefined,
        engineVersion: layout ? ENGINE_VERSION : undefined,
        layout: layout ?? undefined,
      };
      try {
        await store.save(run);
        setSaved({ where: store.kind, fellBack: false });
      } catch {
        // The account refused (signed out in another tab, database down): keep it in this browser.
        await localStore.save({ ...run, folderId: null }).catch(() => {});
        setSaved({ where: "local", fellBack: true });
      }
    },
    [store, target],
  );

  const run = useCallback(
    async (input: { text: string } | { demo: true }, title: string, force = false) => {
      const demo = "demo" in input;
      const engine = live || !demo ? httpEngine : demoEngine;
      if (engine === httpEngine && codeRequired && !storedAccessCode()) {
        setNeedCode(true);
        setEditCode(true);
        requestAnimationFrame(() => codeInput.current?.focus());
        return;
      }
      setNeedCode(false);
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setError(null);
      setNotices([]);
      setFilter("all");
      setIsDemo(demo);
      setLiveRun(engine === httpEngine);
      setDocTitle(title);
      setRows([]);
      setSaved(null);
      setLockedFrom(null);
      lastRun.current = { input, title };
      const text = demo ? DEMO_TEXT : input.text;
      const meta = {
        contract: await contractId(text),
        run: runId(),
        title,
        engine: (engine === httpEngine ? "live" : "offline") as "live" | "offline",
        demo,
        text,
      };
      setIds({ contract: meta.contract, run: meta.run });

      // Same contract, same engine version, reviewed before: show that result exactly, so a
      // contract never gets two different answers (mentor feedback, 2026-10-02).
      if (engine === httpEngine && !force) {
        const prior = await findPrior(meta.contract, text);
        if (prior) {
          const flat = flatText(text);
          const byN = new Map(prior.clauses.map((c) => [c.n, c]));
          const replayed: Row[] = prior.layout!.map((p) => {
            const t = flat.slice(p.span[0], p.span[1]);
            const c = byN.get(p.n);
            return { n: p.n, text: t, ar: true, kind: p.kind, otherType: (p.otherType as Row["otherType"]) ?? null, context: p.context, result: c ? toClauseResult(c, t) : undefined, verbatim: c?.verbatim };
          });
          setRows(replayed);
          setLockedFrom(prior.id);
          setPhase("done");
          await save(replayed, { ...meta, replayedFrom: prior.id });
          return;
        }
      }
      setPhase("running");
      let acc: Row[] = [];
      const fail = (message: L) => {
        setError(message[lang]);
        if (acc.length > 0) {
          // Mid-stream failure: end the run; rows without a result read «لم يُفحص».
          setPhase("done");
          return;
        }
        const texts = demo ? DEMO_CONTRACT.clauses.map((c) => c.text[lang]) : splitClauses(input.text);
        if (texts.length === 0) {
          setPhase("intake");
          return;
        }
        setRows(texts.map((text, i) => ({ n: i + 1, text, ar: !demo })));
        setPhase("offline");
      };
      let failed = false;
      try {
        for await (const ev of engine.review(input, ctrl.signal)) {
          if (ev.type === "clause") {
            acc = [...acc, { n: ev.n, text: ev.text[lang], ar: engine === httpEngine, kind: ev.kind, otherType: ev.otherType, context: ev.context }];
            setRows(acc);
          }
          if (ev.type === "result") {
            acc = acc.map((row) => (row.n === ev.result.n ? { ...row, result: ev.result, verbatim: ev.verbatim } : row));
            setRows(acc);
          }
          if (ev.type === "notice") setNotices((prev) => [...prev, ev.message[lang]]);
          if (ev.type === "error") {
            failed = acc.length === 0;
            fail(ev.message);
          }
          if (ev.type === "done" && !failed) setPhase("done");
        }
        // A stream cut short (no `done`) still ends the run; unfinished rows read as unchecked.
        if (!ctrl.signal.aborted && !failed) setPhase((p) => (p === "running" ? "done" : p));
        if (!ctrl.signal.aborted && !failed) await save(acc, meta);
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
        fail({ ar: "تعذّر الاتصال بالمحرك.", en: "Could not reach the engine." });
      }
    },
    [lang, live, codeRequired, save, findPrior],
  );

  const readFile = async (file: File) => {
    setError(null);
    if (!/\.txt$/i.test(file.name) && file.type !== "text/plain") {
      setError(r.wrongType);
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      setError(r.empty);
      return;
    }
    setAck(false);
    setPending({ text, title: file.name });
  };

  const restart = () => {
    abort.current?.abort();
    setRows([]);
    setPhase("intake");
    setError(null);
    setNotices([]);
    setSaved(null);
  };

  const tally = useMemo(() => {
    const out: Record<Verdict, number> = { nonCompliant: 0, review: 0, abstain: 0, compliant: 0 };
    rows.forEach((row) => row.result && out[row.result.verdict]++);
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    const list = rows.filter((row) => filter === "all" || row.result?.verdict === filter);
    if (sort === "order" || phase !== "done") return list;
    // Rows the engine never finished sort after the verdicts, and text that is not a clause last.
    const rank = (row: Row) => (row.kind === "other" ? PRIORITY.length + 2 : row.kind === "intro" ? PRIORITY.length + 1 : row.result ? PRIORITY.indexOf(row.result.verdict) : PRIORITY.length);
    return [...list].sort((a, b) => rank(a) - rank(b) || a.n - b.n);
  }, [rows, filter, sort, phase]);

  const checked = rows.filter((row) => row.result).length;
  const others = rows.filter((row) => row.kind === "other").length;
  const intros = rows.filter((row) => row.kind === "intro").length;
  const where = store.kind === "remote" ? r.saveWhereAccount : r.saveWhereBrowser;
  const showCodeField = codeRequired && (!hasCode || editCode);

  return (
    <div className={s.app}>
      <AppBar t={t} lang={lang} title={r.title} here="review" />

      {phase === "intake" ? (
        <main className={s.intake}>
          <section className={s.intakeCard} aria-labelledby="intake-title">
            <h1 id="intake-title" className={s.intakeTitle}>{r.intakeTitle}</h1>
            <p className={s.intakeLead}>{r.intakeLead}</p>

            <div className={s.choices}>
              <div className={`${s.choice} ${s.choiceMain}`}>
                <h2 className={s.choiceTitle}>{r.choiceOwnTitle}</h2>
                <p className={s.choiceBody}>{r.choiceOwnBody}</p>
                <div
                  className={s.drop}
                  data-dragging={dragging || undefined}
                  data-disabled={!live || undefined}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (live) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file && live) readFile(file);
                  }}
                >
                  <IconUpload className={s.dropIcon} />
                  <p className={s.dropTitle}>{r.dropTitle}</p>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()} disabled={!live}>
                    {r.choose}
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    disabled={!live}
                    accept=".txt,text/plain"
                    aria-label={r.choose}
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) readFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>
                {!showPaste ? (
                  <button type="button" className={s.linkButton} onClick={() => setShowPaste(true)} disabled={!live}>
                    {r.pasteToggle}
                  </button>
                ) : (
                  <div className={s.paste}>
                    <label htmlFor="paste-box" className={s.pasteLabel}>{r.pasteLabel}</label>
                    <textarea
                      id="paste-box"
                      className={s.pasteBox}
                      disabled={!live}
                      placeholder={r.pastePlaceholder}
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                      dir={pasted ? "auto" : undefined}
                      rows={5}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!live || !pasted.trim()}
                      onClick={() => {
                        setAck(false);
                        setPending({ text: pasted, title: r.pastedTitle });
                      }}
                    >
                      {r.previewCta}
                    </button>
                  </div>
                )}
                {!live && <p className={s.offlineHint}>{r.offlineHint}</p>}
              </div>
            </div>

            {pending && preview && (
              <section className={s.preview} aria-labelledby="preview-title">
                <h3 id="preview-title" className={s.pasteLabel}>{r.previewTitle}</h3>
                <p className={s.offlineHint}>{r.previewLead}</p>
                <p className={s.previewCounts}>
                  {preview.total === 0
                    ? r.previewNone
                    : `${r.previewMasked} ${(Object.entries(preview.counts) as [RedactKind, number][])
                        .filter(([, n]) => n > 0)
                        .map(([k, n]) => `${r.kinds[k]} (${localDigits(String(n), lang)})`)
                        .join(lang === "ar" ? "، " : ", ")}`}
                </p>
                {(["id", "iban", "card", "account", "passport", "deed", "birth"] as RedactKind[]).some((k) => preview.counts[k] > 0) && (
                  <p className={s.previewWarn} role="alert">{r.previewSensitive}</p>
                )}
                {preview.nameHints > 0 && <p className={s.previewWarn} role="alert">{r.previewNames}</p>}
                <div className={s.previewText} dir="auto" tabIndex={0}>{preview.text}</div>
                <p className={s.offlineHint}>{r.privacyNote}</p>
                <label className={s.ack}>
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  <span>{r.ackLabel}</span>
                </label>
                <div className={s.previewActions}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!ack}
                    onClick={() => {
                      const p = pending;
                      setPending(null);
                      setAck(false);
                      run({ text: preview.text }, p.title);
                    }}
                  >
                    {r.sendReview}
                    <IconArrow className="btn-arrow" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>
                    {r.cancelPreview}
                  </button>
                </div>
              </section>
            )}

            <div className={s.options}>
              {FEATURES.dashboard && (
                <label className={s.option}>
                  <span className={s.optionLabel}>
                    {r.saveLabel} <small>({where})</small>
                  </span>
                  <select className={s.select} value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="general">{r.saveGeneral}</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                    <option value="none">{r.saveNone}</option>
                  </select>
                </label>
              )}

              {codeRequired && (
                <div className={s.option} data-attention={needCode || undefined}>
                  {showCodeField ? (
                    <>
                      <label htmlFor="access-code" className={s.optionLabel}>{r.accessLabel}</label>
                      <input
                        id="access-code"
                        className={s.accessBox}
                        type="password"
                        autoComplete="off"
                        dir="auto"
                        ref={(el) => {
                          codeInput.current = el;
                          // Filled after hydration, so the server and client markup agree.
                          if (el && !el.value) el.value = storedAccessCode();
                        }}
                        onChange={(e) => {
                          saveAccessCode(e.target.value);
                          setHasCode(Boolean(e.target.value.trim()));
                          if (e.target.value.trim()) setNeedCode(false);
                        }}
                      />
                      <p className={s.offlineHint} role={needCode ? "alert" : undefined}>{needCode ? r.codeNeeded : r.accessHint}</p>
                    </>
                  ) : (
                    <p className={s.codeSaved}>
                      {r.codeSaved}{" "}
                      <button type="button" className={s.linkButton} onClick={() => setEditCode(true)}>
                        {r.codeChange}
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={s.demoRow}>
              <p className={s.choiceBody}>{r.demoPrompt}</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ demo: true }, DEMO_CONTRACT.title[lang])}>
                {r.useDemo}
                <IconArrow className="btn-arrow" />
              </button>
            </div>

            <details className={s.privacy}>
              <summary>
                {r.privacyShort} <span className={s.privacyMore}>{r.privacyMore}</span>
              </summary>
              <p className={s.offlineHint}>
                {r.privacyNote}{" "}
                <Link href={localePath(lang, "/privacy")} className={s.privacyLink}>{r.privacyLink}</Link>
              </p>
            </details>

            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
          </section>
        </main>
      ) : (
        <main className={s.workspace}>
          <aside className={s.summary} aria-label={r.filterLabel}>
            <div className={s.docHead}>
              <p className={s.docTitle}>{docTitle}</p>
              {ids && (
                <dl className={s.ids}>
                  <div>
                    <dt>{r.contractIdLabel}</dt>
                    <dd>
                      <bdi dir="ltr">{ids.contract}</bdi>
                    </dd>
                  </div>
                  <div>
                    <dt>{r.runIdLabel}</dt>
                    <dd>
                      <bdi dir="ltr">{ids.run}</bdi>
                    </dd>
                  </div>
                </dl>
              )}
              <p className={s.docMeta}>
                {localDigits(String(rows.length - others - intros), lang)} {r.clauses}
                {others > 0 && ` · ${r.otherCount}: ${localDigits(String(others), lang)}`}
                {phase === "running" && (
                  <>
                    {" · "}
                    {r.scanning} {localDigits(String(checked), lang)}/{localDigits(String(rows.length - others - intros), lang)}
                  </>
                )}
              </p>
              {isDemo && phase !== "offline" && <p className={s.demoBadge}>{liveRun ? r.demoBadgeLive : r.demoBadge}</p>}
              {saved && ids && (
                <p className={s.savedNote} role="status">
                  {saved.fellBack ? r.saveFailed : saved.where === "remote" ? r.savedIn : r.savedLocal}{" "}
                  <Link href={`${localePath(lang, "/dashboard")}?run=${ids.run}`} className={s.privacyLink}>
                    {r.openInDashboard}
                  </Link>
                </p>
              )}
            </div>

            {phase !== "offline" && (
              <>
                <div className={s.filters} role="group" aria-label={r.filterLabel}>
                  <button type="button" className={s.filter} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                    <span>{r.all}</span>
                    <span className={s.count}>{localDigits(String(checked), lang)}</span>
                  </button>
                  {PRIORITY.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`${s.filter} ${s[`f_${v}`]}`}
                      aria-pressed={filter === v}
                      onClick={() => setFilter(filter === v ? "all" : v)}
                      disabled={phase === "done" && tally[v] === 0}
                    >
                      <span className={s.filterMark} aria-hidden>
                        <picture>
                          <source srcSet={`/assets/plates/${MARK[v]}.webp`} type="image/webp" />
                          <img src={`/assets/plates/${MARK[v]}.png`} alt="" />
                        </picture>
                      </span>
                      <span className={s.filterLabel}>{t.verdicts[v]}</span>
                      <span className={s.count}>{localDigits(String(tally[v]), lang)}</span>
                    </button>
                  ))}
                </div>
                <div className={s.sort} role="group">
                  <button type="button" aria-pressed={sort === "priority"} onClick={() => setSort("priority")} disabled={phase !== "done"}>
                    {r.sortPriority}
                  </button>
                  <button type="button" aria-pressed={sort === "order"} onClick={() => setSort("order")} disabled={phase !== "done"}>
                    {r.sortOrder}
                  </button>
                </div>
              </>
            )}

            {phase === "done" && checked > 0 && (
              <ExportMenu
                t={t}
                lang={lang}
                model={() => ({
                  fileName: docTitle,
                  contractId: ids?.contract ?? null,
                  runId: ids?.run ?? null,
                  createdAt: new Date().toISOString(),
                  engine: liveRun ? "live" : "offline",
                  demo: isDemo,
                  rows,
                })}
              />
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
              {r.restart}
            </button>
            <p className={s.disclaimer}>{r.disclaimer}</p>
          </aside>

          <section className={s.register} aria-live="polite" aria-busy={phase === "running"}>
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            {lockedFrom && (
              <div className={s.locked} role="status">
                <p>
                  {r.lockedNotice}{" "}
                  <bdi dir="ltr">{lockedFrom}</bdi>
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => lastRun.current && run(lastRun.current.input, lastRun.current.title, true)}
                >
                  {r.lockedRerun}
                </button>
              </div>
            )}
            {notices.map((m) => <p key={m} className={s.notice}>{m}</p>)}
            {/* No dead air: before the first clause event the engine is splitting the document. */}
            {phase === "running" && rows.length === 0 && <p className={s.splitting}>{r.splitting}</p>}
            {phase === "offline" && <p className={s.offline}>{r.engineOfflineUpload}</p>}
            <ol className={s.rows}>
              {visible.map((row) => (
                <ClauseRow key={row.n} row={row} t={t} lang={lang} offline={phase !== "running"} />
              ))}
            </ol>
          </section>
        </main>
      )}
    </div>
  );
}
