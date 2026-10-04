import { DEMO_CONTRACT } from "@/content/contract";
import { UNITS } from "@/content/units";
import type { ReviewEvent } from "./review-types";

/**
 * The review engine contract the UI depends on. The demo engine replays authored results
 * offline; the HTTP engine streams the server engine's NDJSON events from POST /api/review.
 */
export type { ReviewEvent };

export interface ReviewEngine {
  review(input: { text: string } | { demo: true }, signal: AbortSignal): AsyncGenerator<ReviewEvent>;
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

/** AbortSignal.any, with a fallback for browsers that lack it (Safari before 17.4). */
export function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const ctrl = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      ctrl.abort(s.reason);
      break;
    }
    s.addEventListener("abort", () => ctrl.abort(s.reason), { once: true, signal: ctrl.signal });
  }
  return ctrl.signal;
}

/** Every quoted unit must exist and be quoted in full; this is the check shown in the UI. */
export const verbatimOk = (citations: string[]) =>
  citations.every((id) => {
    const unit = UNITS[id];
    return Boolean(unit && unit.text.length > 0);
  });

export const demoEngine: ReviewEngine = {
  async *review(_input, signal) {
    for (const c of DEMO_CONTRACT.clauses) {
      yield { type: "clause", n: c.n, text: c.text };
    }
    for (const c of DEMO_CONTRACT.clauses) {
      await wait(420 + ((c.n * 137) % 380), signal);
      yield { type: "result", result: c, verbatim: verbatimOk(c.citations) };
    }
    yield { type: "done" };
  },
};

/** One NDJSON line → event; a malformed line becomes an error event instead of throwing. */
function parseLine(raw: string): ReviewEvent | null {
  const line = raw.trim();
  if (!line) return null;
  try {
    return JSON.parse(line) as ReviewEvent;
  } catch {
    return { type: "error", message: { ar: "وصل رد غير مفهوم من المحرك.", en: "Received an unreadable response from the engine." } };
  }
}

/** The engine sends a line per clause event and per finished clause; a live review never goes
 *  this long without a byte (the server's own per-clause deadline is 120 s). */
export const IDLE_MS = 150_000;
const STALLED = Symbol("stalled");

/** The access code the reader entered once (kept in this browser only). */
export const ACCESS_CODE_KEY = "mizan-access-code";
// Fallback when storage is blocked (private mode): the code then lasts for this page only.
let memoryCode = "";
export function storedAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_CODE_KEY) ?? memoryCode;
  } catch {
    return memoryCode;
  }
}
export function saveAccessCode(v: string): void {
  memoryCode = v;
  try {
    localStorage.setItem(ACCESS_CODE_KEY, v);
  } catch {
    // Storage blocked: memoryCode carries it.
  }
}

const REFUSED: Record<number, { ar: string; en: string }> = {
  401: { ar: "رمز الدخول غير صحيح أو ناقص. أدخل الرمز الذي أعطاك إياه فريق مِداد.", en: "The access code is missing or wrong. Enter the code the Midad team gave you." },
  413: { ar: "الوثيقة أطول من المسموح للفحص الحقيقي.", en: "The document is longer than a live review allows." },
  429: { ar: "وصلت إلى الحد المسموح من الفحوصات في الساعة. حاول بعد قليل، أو استخدم وضع دون اتصال.", en: "You reached the hourly review limit. Try again shortly, or use offline mode." },
  503: { ar: "وصل الموقع إلى السقف اليومي للفحص الحقيقي. استخدم وضع دون اتصال.", en: "The site reached its daily cap for live reviews. Use offline mode." },
};

export function makeHttpEngine({ idleMs = IDLE_MS, fetchImpl, accessCode = storedAccessCode }: { idleMs?: number; fetchImpl?: typeof fetch; accessCode?: () => string } = {}): ReviewEngine {
  return {
    async *review(input, signal) {
      const text = "text" in input ? input.text : DEMO_CONTRACT.clauses.map((c, i) => `${i + 1}- ${c.text.ar}`).join("\n");
      // Watchdog: re-armed on every chunk. When it fires, the fetch is aborted and the review ends
      // with an error event, so the UI's fail path marks the unfinished rows «لم يُفحص».
      const idle = new AbortController();
      const stalled = new Promise<typeof STALLED>((resolve) => idle.signal.addEventListener("abort", () => resolve(STALLED), { once: true }));
      // A caller abort must surface as an AbortError even if the transport ignores the signal.
      const cancelled = new Promise<never>((_, reject) => {
        const fire = () => reject(new DOMException("aborted", "AbortError"));
        if (signal.aborted) fire();
        else signal.addEventListener("abort", fire, { once: true });
      });
      cancelled.catch(() => {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => idle.abort(), idleMs);
      };
      const within = <T,>(p: Promise<T>) => Promise.race([p, stalled, cancelled]);
      const stopped: ReviewEvent = { type: "error", message: { ar: "توقف المحرك عن الاستجابة.", en: "The engine stopped responding." } };
      const doFetch = fetchImpl ?? fetch;
      let reader: ReadableStreamDefaultReader<string> | undefined;
      try {
        arm();
        const res = await within(
          doFetch("/api/review", {
            method: "POST",
            body: JSON.stringify({ text }),
            headers: { "content-type": "application/json", "x-mizan-code": encodeURIComponent(accessCode()) },
            signal: anySignal([signal, idle.signal]),
          }),
        );
        if (res === STALLED) {
          yield stopped;
          return;
        }
        if (!res.ok || !res.body) {
          yield { type: "error", message: REFUSED[res.status] ?? { ar: "تعذّر الاتصال بالمحرك.", en: "Could not reach the engine." } };
          yield { type: "done" };
          return;
        }
        reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          arm();
          const r = await within(reader.read());
          if (r === STALLED) {
            yield stopped;
            return;
          }
          const { value, done } = r;
          if (done) break;
          buf += value;
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const ev = parseLine(buf.slice(0, nl));
            buf = buf.slice(nl + 1);
            if (ev) yield ev;
          }
        }
        // A final event the server did not terminate with a newline.
        const last = parseLine(buf);
        if (last) yield last;
      } finally {
        clearTimeout(timer);
        if (!idle.signal.aborted) idle.abort();
        reader?.cancel().catch(() => {});
      }
    },
  };
}

export const httpEngine: ReviewEngine = makeHttpEngine();

/** Split plain contract text into clauses: numbered lines, then paragraphs. */
export function splitClauses(raw: string): string[] {
  const text = raw.replace(/\r/g, "").trim();
  const numbered = text.split(/\n(?=\s*(?:\d+|[٠-٩]+)\s*[-.)–]\s)/);
  const parts = numbered.length > 1 ? numbered : text.split(/\n\s*\n/);
  return parts.map((p) => p.replace(/^\s*(?:\d+|[٠-٩]+)\s*[-.)–]\s*/, "").replace(/\s+/g, " ").trim()).filter(Boolean);
}
