"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppBar } from "@/components/app/AppBar";
import { ClauseRow } from "@/components/review/ClauseRow";
import { ExportMenu } from "@/components/review/ExportMenu";
import { IconArrow } from "@/components/icons";
import type { Dictionary, Locale } from "@/lib/i18n";
import { localDigits } from "@/lib/format";
import { localePath } from "@/lib/paths";
import { PRIORITY, type Verdict } from "@/lib/review-types";
import { account, hasLocalRuns, localStore, moveLocalToAccount, pickStore, type AccountState, type RunStore } from "@/lib/run-store";
import type { Decision, Folder, RunSummary, StoredClause, StoredRun } from "@/lib/runs";
import s from "./dashboard.module.css";

const MARK: Record<Verdict, string> = { nonCompliant: "stamp-red", review: "stamp-bracket", abstain: "stamp-dashed", compliant: "stamp-round" };
type View = "all" | "general" | string;
const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

export function Dashboard({ t, lang }: { t: Dictionary; lang: Locale }) {
  const d = t.dashboard;
  const num = (v: string | number) => localDigits(String(v), lang);
  // Arabic counts: 2 is a dual («مرتين»), 3–10 take a plural, 11+ a singular.
  const times = (n: number) => (n === 2 ? d.times.two : fill(n <= 10 ? d.times.few : d.times.many, { n: num(n) }));
  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" });

  const [state, setState] = useState<AccountState | null>(null);
  const [store, setStore] = useState<RunStore>(localStore);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [view, setView] = useState<View>("all");
  const [open, setOpen] = useState<StoredRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async (st: RunStore) => {
    const list = await st.list().catch(() => ({ runs: [] as RunSummary[], folders: [] as Folder[] }));
    setRuns(list.runs);
    setFolders(list.folders);
    setLoaded(true);
  }, []);

  const openRun = useCallback(
    async (st: RunStore, id: string | null) => {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("run", id);
      else url.searchParams.delete("run");
      window.history.replaceState(null, "", url);
      setOpen(id ? await st.get(id) : null);
      window.scrollTo({ top: 0 });
    },
    [],
  );

  const boot = useCallback(async () => {
    const { store: st, state: acc } = await pickStore();
    setState(acc);
    setStore(st);
    await refresh(st);
    const want = new URLSearchParams(window.location.search).get("run");
    if (want) setOpen(await st.get(want));
  }, [refresh]);

  useEffect(() => {
    // Loads the account state and saved reviews once, after mount (the page itself is static).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    boot();
  }, [boot]);

  const counts = useMemo(() => {
    const byFolder = new Map<string, number>();
    const byContract = new Map<string, number>();
    let general = 0;
    for (const r of runs) {
      if (r.folderId) byFolder.set(r.folderId, (byFolder.get(r.folderId) ?? 0) + 1);
      else general++;
      byContract.set(r.contractId, (byContract.get(r.contractId) ?? 0) + 1);
    }
    return { byFolder, byContract, general };
  }, [runs]);

  const shown = runs.filter((r) => view === "all" || (view === "general" ? !r.folderId : r.folderId === view));
  const folderName = (id: string | null) => (id ? folders.find((f) => f.id === id)?.name ?? d.general : d.general);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.app}>
      <AppBar t={t} lang={lang} title={d.title} here="dashboard" />
      <main className={s.layout}>
        <aside className={s.side}>
          <AccountBox
            t={t}
            state={state}
            onChange={async (msg) => {
              setFlash(msg);
              setOpen(null);
              await boot();
            }}
          />

          <nav className={s.folders} aria-label={d.folders}>
            <p className={s.sideLabel}>{d.folders}</p>
            <FolderButton label={d.all} count={num(runs.length)} active={view === "all"} onClick={() => setView("all")} />
            <FolderButton label={d.general} count={num(counts.general)} active={view === "general"} onClick={() => setView("general")} />
            {folders.map((f) => (
              <FolderRow
                key={f.id}
                t={t}
                folder={f}
                count={num(counts.byFolder.get(f.id) ?? 0)}
                active={view === f.id}
                onOpen={() => setView(f.id)}
                onRename={(name) => act(async () => { await store.renameFolder(f.id, name); await refresh(store); })}
                onDelete={() =>
                  window.confirm(d.deleteFolderConfirm) &&
                  act(async () => {
                    await store.deleteFolder(f.id);
                    if (view === f.id) setView("general");
                    await refresh(store);
                  })
                }
              />
            ))}
            <NewFolder t={t} disabled={busy} onCreate={(name) => act(async () => { const f = await store.createFolder(name); await refresh(store); setView(f.id); })} />
          </nav>
          <p className={s.note}>{d.retention}</p>
        </aside>

        <section className={s.main} aria-live="polite">
          {flash && (
            <p className={s.flash} role="status">
              {flash}
            </p>
          )}
          {open ? (
            <RunView
              t={t}
              lang={lang}
              run={open}
              folders={folders}
              siblings={runs.filter((r) => r.contractId === open.contractId && r.id !== open.id)}
              when={when}
              busy={busy}
              onBack={() => openRun(store, null)}
              onOpen={(id) => openRun(store, id)}
              onMove={(folderId) => act(async () => { const r = await store.move(open.id, folderId); if (r) setOpen(r); await refresh(store); })}
              onDecide={(n, dec) => act(async () => { const r = await store.decide(open.id, n, dec); if (r) setOpen(r); await refresh(store); })}
              onDelete={() => window.confirm(d.deleteRunConfirm) && act(async () => { await store.remove(open.id); await openRun(store, null); await refresh(store); })}
            />
          ) : (
            <>
              <div className={s.head}>
                <h1 className={s.title}>{view === "all" ? d.all : view === "general" ? d.general : folderName(view)}</h1>
                <Link href={`${localePath(lang, "/review")}${view !== "all" && view !== "general" ? `?folder=${view}` : ""}`} className="btn btn-sm">
                  {d.newReview}
                  <IconArrow className="btn-arrow" />
                </Link>
              </div>
              {loaded && shown.length === 0 && <p className={s.empty}>{d.empty}</p>}
              <ol className={s.list}>
                {shown.map((r) => (
                  <li key={r.id} className={s.card}>
                    <div className={s.cardMain}>
                      <button type="button" className={s.cardTitle} onClick={() => openRun(store, r.id)}>
                        {r.fileName}
                      </button>
                      <p className={s.meta}>
                        <span>
                          {t.review.contractIdLabel} <bdi dir="ltr">{r.contractId}</bdi>
                        </span>
                        <span>
                          {t.review.runIdLabel} <bdi dir="ltr">{r.id}</bdi>
                        </span>
                        <span>{when(r.createdAt)}</span>
                      </p>
                      <p className={s.tags}>
                        <span className={s.tag}>{r.engine === "live" ? d.engineLive : d.engineOffline}</span>
                        {r.demo && <span className={s.tag}>{d.demo}</span>}
                        {view === "all" && <span className={s.tag}>{folderName(r.folderId)}</span>}
                        {(counts.byContract.get(r.contractId) ?? 0) > 1 && (
                          <span className={`${s.tag} ${s.tagStrong}`}>{fill(d.reviewedTimes, { n: times(counts.byContract.get(r.contractId) ?? 0) })}</span>
                        )}
                      </p>
                    </div>
                    <Tally tally={r.tally} t={t} num={num} />
                    <p className={s.decided}>{fill(d.decided, { d: num(r.decided), n: num(Object.values(r.tally).reduce((a, b) => a + b, 0)) })}</p>
                    <div className={s.cardActions}>
                      <button type="button" className="btn btn-sm" onClick={() => openRun(store, r.id)}>
                        {d.open}
                      </button>
                      <label className={s.move}>
                        <span className="sr-only">{d.moveTo}</span>
                        <select
                          className={s.select}
                          value={r.folderId ?? ""}
                          disabled={busy}
                          onChange={(e) => act(async () => { await store.move(r.id, e.target.value || null); await refresh(store); })}
                        >
                          <option value="">
                            {d.moveTo}: {d.general}
                          </option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {d.moveTo}: {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-sm ${s.danger}`}
                        disabled={busy}
                        onClick={() => window.confirm(d.deleteRunConfirm) && act(async () => { await store.remove(r.id); await refresh(store); })}
                      >
                        {d.remove}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Tally({ tally, t, num }: { tally: Record<Verdict, number>; t: Dictionary; num: (v: number) => string }) {
  return (
    <ul className={s.tally} aria-label={t.review.filterLabel}>
      {PRIORITY.map((v) => (
        <li key={v} data-zero={tally[v] === 0 || undefined} title={t.verdicts[v]}>
          <span className={s.mark} aria-hidden>
            <picture>
              <source srcSet={`/assets/plates/${MARK[v]}.webp`} type="image/webp" />
              <img src={`/assets/plates/${MARK[v]}.png`} alt="" />
            </picture>
          </span>
          <span className="sr-only">{t.verdicts[v]}</span>
          <span className={s.markCount}>{num(tally[v])}</span>
        </li>
      ))}
    </ul>
  );
}

function FolderButton({ label, count, active, onClick }: { label: string; count: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={s.folder} aria-current={active ? "true" : undefined} onClick={onClick}>
      <span>{label}</span>
      <span className={s.count}>{count}</span>
    </button>
  );
}

function FolderRow({ t, folder, count, active, onOpen, onRename, onDelete }: {
  t: Dictionary; folder: Folder; count: string; active: boolean; onOpen: () => void; onRename: (name: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  if (editing)
    return (
      <form
        className={s.folderEdit}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onRename(name.trim());
          setEditing(false);
        }}
      >
        <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label={t.dashboard.rename} autoFocus />
        <button type="submit" className={s.textBtn}>{t.dashboard.save}</button>
        <button type="button" className={s.textBtn} onClick={() => setEditing(false)}>{t.dashboard.cancel}</button>
      </form>
    );
  return (
    <div className={s.folderRow}>
      <FolderButton label={folder.name} count={count} active={active} onClick={onOpen} />
      <button type="button" className={s.iconBtn} onClick={() => setEditing(true)} aria-label={`${t.dashboard.rename}: ${folder.name}`} title={t.dashboard.rename}>
        ✎
      </button>
      <button type="button" className={s.iconBtn} onClick={onDelete} aria-label={`${t.dashboard.remove}: ${folder.name}`} title={t.dashboard.remove}>
        ✕
      </button>
    </div>
  );
}

function NewFolder({ t, disabled, onCreate }: { t: Dictionary; disabled: boolean; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className={s.newFolder}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name.trim());
        setName("");
      }}
    >
      <label className="sr-only" htmlFor="new-folder">{t.dashboard.newFolder}</label>
      <input id="new-folder" className={s.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t.dashboard.newFolderPlaceholder} />
      <button type="submit" className="btn btn-ghost btn-sm" disabled={disabled || !name.trim()}>
        {t.dashboard.create}
      </button>
    </form>
  );
}

function AccountBox({ t, state, onChange }: { t: Dictionary; state: AccountState | null; onChange: (flash: string | null) => void }) {
  const d = t.dashboard;
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!state) return <div className={s.account} aria-busy="true" />;
  if (!state.accounts)
    return (
      <div className={s.account}>
        <p className={s.sideLabel}>{d.account}</p>
        <p className={s.note}>{d.accountsOff}</p>
      </div>
    );
  if (state.user)
    return (
      <div className={s.account}>
        <p className={s.sideLabel}>{d.account}</p>
        <p className={s.who}>
          {d.signedInAs} <strong>{state.user.username}</strong>
        </p>
        <div className={s.accountActions}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await account.logout().catch(() => {}); onChange(null); }}>
            {d.signOut}
          </button>
          <button
            type="button"
            className={`${s.textBtn} ${s.danger}`}
            onClick={async () => {
              if (!window.confirm(d.deleteAccountConfirm)) return;
              await account.remove().catch(() => {});
              onChange(null);
            }}
          >
            {d.deleteAccount}
          </button>
        </div>
      </div>
    );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await (mode === "signup" ? account.signup(username, password) : account.login(username, password));
      const moved = hasLocalRuns() ? await moveLocalToAccount() : 0;
      setPassword("");
      onChange(moved ? fill(d.movedLocal, { n: moved }) : null);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "other";
      setErr((d.errors as Record<string, string>)[code] ?? d.errors.other);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.account}>
      <div className={s.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>{d.signIn}</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => setMode("signup")}>{d.signUp}</button>
      </div>
      <form className={s.form} onSubmit={submit}>
        <label className={s.field}>
          <span>{d.username}</span>
          <input className={s.input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" dir="auto" required minLength={3} maxLength={32} />
        </label>
        <label className={s.field}>
          <span>{d.password}</span>
          <input className={s.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} />
        </label>
        {err && <p className={s.error} role="alert">{err}</p>}
        <button type="submit" className="btn btn-sm" disabled={busy}>
          {mode === "signup" ? d.signUp : d.signIn}
        </button>
        <p className={s.note}>{d.accountNote}</p>
        <p className={s.note}>{d.localNote}</p>
      </form>
    </div>
  );
}

function RunView({ t, lang, run, folders, siblings, when, busy, onBack, onOpen, onMove, onDecide, onDelete }: {
  t: Dictionary; lang: Locale; run: StoredRun; folders: Folder[]; siblings: RunSummary[]; when: (iso: string) => string; busy: boolean;
  onBack: () => void; onOpen: (id: string) => void; onMove: (folderId: string | null) => void; onDecide: (n: number, d: Decision | null) => void; onDelete: () => void;
}) {
  const d = t.dashboard;
  const num = (v: string | number) => localDigits(String(v), lang);
  const ordered = [...run.clauses].sort((a, b) => PRIORITY.indexOf(a.verdict) - PRIORITY.indexOf(b.verdict) || a.n - b.n);
  const tally: Record<Verdict, number> = { nonCompliant: 0, review: 0, abstain: 0, compliant: 0 };
  run.clauses.forEach((c) => tally[c.verdict]++);
  const row = (c: StoredClause) => ({
    n: c.n,
    text: c.excerpt,
    ar: !run.demo,
    verbatim: c.verbatim,
    result: { n: c.n, text: { ar: c.excerpt, en: c.excerpt }, verdict: c.verdict, citations: c.citations, reason: c.reason, suggestion: c.suggestion, flags: c.flags as never, marks: c.marks, units: c.units, affirmedBy: c.affirmedBy, roles: c.roles, related: c.related },
  });
  const auditText = (e: StoredRun["audit"][number]) => {
    if (e.kind === "reviewed") {
      const [eng, replay, from] = e.detail.split(":");
      const base = `${d.auditReviewed} (${eng === "live" ? d.engineLive : d.engineOffline})`;
      return replay === "replay" ? `${base}. ${d.auditReplayed} ${from}` : base;
    }
    if (e.kind === "moved") return `${d.auditMoved}: ${e.detail ? folders.find((f) => f.id === e.detail)?.name ?? "—" : d.general}`;
    const [n, dec] = e.detail.split(":");
    return dec === "clear" ? fill(d.auditCleared, { n: num(n) }) : fill(d.auditDecision, { n: num(n), d: t.review.decisions[dec as Decision] ?? dec });
  };
  return (
    <article className={s.run}>
      <button type="button" className={s.back} onClick={onBack}>
        <IconArrow className={s.backIcon} />
        {d.back}
      </button>
      <div className={s.runHead}>
        <div>
          <h1 className={s.title}>{run.fileName}</h1>
          <dl className={s.runIds}>
            <div>
              <dt>{t.review.contractIdLabel}</dt>
              <dd><bdi dir="ltr">{run.contractId}</bdi></dd>
            </div>
            <div>
              <dt>{t.review.runIdLabel}</dt>
              <dd><bdi dir="ltr">{run.id}</bdi></dd>
            </div>
            <div>
              <dt>{d.date}</dt>
              <dd>{when(run.createdAt)}</dd>
            </div>
          </dl>
          <p className={s.tags}>
            <span className={s.tag}>{run.engine === "live" ? d.engineLive : d.engineOffline}</span>
            {run.demo && <span className={s.tag}>{d.demo}</span>}
          </p>
        </div>
        <div className={s.runSide}>
          <Tally tally={tally} t={t} num={(v) => num(v)} />
          <ExportMenu
            t={t}
            lang={lang}
            model={() => ({
              fileName: run.fileName,
              contractId: run.contractId,
              runId: run.id,
              createdAt: run.createdAt,
              engine: run.engine,
              demo: run.demo,
              rows: run.clauses.map(row),
              decisions: run.decisions,
            })}
          />
          <label className={s.move}>
            <span className="sr-only">{d.moveTo}</span>
            <select className={s.select} value={run.folderId ?? ""} disabled={busy} onChange={(e) => onMove(e.target.value || null)}>
              <option value="">{d.moveTo}: {d.general}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{d.moveTo}: {f.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className={s.disclaimer}>{t.review.disclaimer}</p>

      <ol className={s.rows}>
        {ordered.map((c) => (
          <ClauseRow
            key={c.n}
            row={row(c)}
            t={t}
            lang={lang}
            offline
            committee={{ value: run.decisions[String(c.n)]?.d ?? null, onChange: (dec) => onDecide(c.n, dec), busy }}
          />
        ))}
      </ol>

      {siblings.length > 0 && (
        <section className={s.section}>
          <h2 className={s.sectionTitle}>{d.otherRuns}</h2>
          <ul className={s.siblings}>
            {siblings.map((r) => (
              <li key={r.id}>
                <button type="button" className={s.textBtn} onClick={() => onOpen(r.id)}>
                  <bdi dir="ltr">{r.id}</bdi>
                </button>{" "}
                · {when(r.createdAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={s.section}>
        <h2 className={s.sectionTitle}>{d.audit}</h2>
        <ol className={s.audit}>
          {[...run.audit].reverse().map((e, i) => (
            <li key={i}>
              <time>{when(e.at)}</time>
              <span>{auditText(e)}</span>
            </li>
          ))}
        </ol>
      </section>

      <button type="button" className={`btn btn-ghost btn-sm ${s.danger}`} onClick={onDelete} disabled={busy}>
        {d.remove}
      </button>
    </article>
  );
}
