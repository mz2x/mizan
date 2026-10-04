// The two identifiers the mentors asked for (2026-10-01), in two shapes that cannot be confused:
//   contract  C-XXXX-XXXX     a fingerprint of the contract's masked text: the same text always gets
//                             the same id, whatever the file is called;
//   run       R-YYMMDD-XXXX   one per review: re-uploading the same contract is a new run of the
//                             same contract.
// A clause is referenced as <contract>/<two-digit clause number>, e.g. C-7KQ4-M2XD/05.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function base32(bytes: Uint8Array, chars: number): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5 && out.length < chars) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
    if (out.length >= chars) break;
  }
  return out;
}

/** Text that differs only in spacing, harakat, tatweel or digit script is the same contract. */
export function normalizeForId(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ـً-ْٰ]/g, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

export async function contractId(maskedText: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizeForId(maskedText))));
  const s = base32(digest, 8);
  return `C-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Date in Riyadh time, so a run started after midnight in the Kingdom carries that day. */
export function runId(now: Date = new Date(), random: Uint8Array = crypto.getRandomValues(new Uint8Array(3))): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `R-${get("year")}${get("month")}${get("day")}-${base32(random, 4)}`;
}

export const clauseRef = (contract: string, n: number) => `${contract}/${String(n).padStart(2, "0")}`;

export const isContractId = (v: string) => /^C-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(v);
export const isRunId = (v: string) => /^R-\d{6}-[0-9A-HJKMNP-TV-Z]{4}$/.test(v);
