import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHttpEngine, type ReviewEvent } from "./engine";

// Final fix wave, item 1 (client side): a stream that goes silent must not hang the UI. When no
// bytes arrive for the idle window, the fetch is aborted and an error event ends the review, so
// ReviewApp's existing fail path marks the remaining rows «لم يُفحص».
function stallingFetch(firstLines: string[]) {
  const seen: { signal?: AbortSignal | null } = {};
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    seen.signal = init?.signal;
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const l of firstLines) controller.enqueue(enc.encode(l + "\n"));
        // ...then nothing, ever: no more bytes and no close.
      },
    });
    return new Response(body, { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}

test("no bytes for the idle window: the fetch is aborted, an error event is yielded, and the stream ends", async () => {
  const { fetchImpl, seen } = stallingFetch([JSON.stringify({ type: "clause", n: 1, text: { ar: "بند", en: "بند" } })]);
  const engine = makeHttpEngine({ idleMs: 50, fetchImpl });
  const out: ReviewEvent[] = [];
  const t0 = Date.now();
  for await (const e of engine.review({ text: "١- بند" }, new AbortController().signal)) out.push(e);
  assert.ok(Date.now() - t0 < 2000, "the idle timer must end the stream");
  assert.deepEqual(out.map((e) => e.type), ["clause", "error"]);
  const err = out[1] as Extract<ReviewEvent, { type: "error" }>;
  assert.deepEqual(err.message, { ar: "توقف المحرك عن الاستجابة.", en: "The engine stopped responding." });
  assert.equal(seen.signal?.aborted, true, "the fetch must be aborted, not left open");
});

test("a stream that keeps sending stays alive and ends normally", async () => {
  const lines = [
    JSON.stringify({ type: "clause", n: 1, text: { ar: "بند", en: "بند" } }),
    JSON.stringify({ type: "done" }),
  ];
  const fetchImpl = (async () => new Response(lines.join("\n") + "\n", { status: 200 })) as unknown as typeof fetch;
  const engine = makeHttpEngine({ idleMs: 50, fetchImpl });
  const out: ReviewEvent[] = [];
  for await (const e of engine.review({ text: "١- بند" }, new AbortController().signal)) out.push(e);
  assert.deepEqual(out.map((e) => e.type), ["clause", "done"]);
});

test("a caller abort still surfaces as an AbortError (the UI treats it as a cancel, not a failure)", async () => {
  const { fetchImpl } = stallingFetch([]);
  const engine = makeHttpEngine({ idleMs: 5_000, fetchImpl });
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 20);
  await assert.rejects(
    (async () => { for await (const _ of engine.review({ text: "١- بند" }, ctrl.signal)) void _; })(),
    (e: unknown) => (e as DOMException).name === "AbortError",
  );
});

// Residual fix: AbortSignal.any is missing before Safari 17.4. anySignal must work without it.
test("anySignal aborts when either input aborts, without AbortSignal.any", async () => {
  const { anySignal } = await import("./engine");
  const original = AbortSignal.any;
  try {
    (AbortSignal as { any?: unknown }).any = undefined;
    const a = new AbortController();
    const b = new AbortController();
    const s = anySignal([a.signal, b.signal]);
    assert.equal(s.aborted, false);
    b.abort();
    assert.equal(s.aborted, true);
    const pre = new AbortController();
    pre.abort();
    assert.equal(anySignal([pre.signal, new AbortController().signal]).aborted, true);
  } finally {
    AbortSignal.any = original;
  }
});

// Protection (2026-10-01): the access code travels in a header, and refusals read plainly.
test("the access code is sent as x-mizan-code, and a 401 becomes a clear error", async () => {
  const { makeHttpEngine } = await import("./engine");
  let header: string | null = null;
  const fetchImpl = (async (_u: string, init?: RequestInit) => {
    header = new Headers(init?.headers).get("x-mizan-code");
    return new Response(JSON.stringify({ error: "code" }), { status: 401 });
  }) as unknown as typeof fetch;
  const engine = makeHttpEngine({ fetchImpl, accessCode: () => "سر-1" });
  const out: ReviewEvent[] = [];
  for await (const e of engine.review({ text: "بند" }, new AbortController().signal)) out.push(e);
  assert.equal(decodeURIComponent(header ?? ""), "سر-1");
  const err = out.find((e) => e.type === "error");
  assert.ok(err && err.type === "error" && err.message.ar.includes("رمز الدخول"));
});

test("429 and 503 refusals say why", async () => {
  const { makeHttpEngine } = await import("./engine");
  for (const [status, word] of [[429, "الحد"], [503, "السقف اليومي"]] as const) {
    const fetchImpl = (async () => new Response("{}", { status })) as unknown as typeof fetch;
    const out: ReviewEvent[] = [];
    for await (const e of makeHttpEngine({ fetchImpl, accessCode: () => "" }).review({ text: "بند" }, new AbortController().signal)) out.push(e);
    const err = out.find((e) => e.type === "error");
    assert.ok(err && err.type === "error" && err.message.ar.includes(word), `${status}`);
  }
});
