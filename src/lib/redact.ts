// Shared by the server (pipeline, before any model call) and the review page (preview before sending).
// Personal data is masked before any contract text reaches the model, which runs outside the
// Kingdom (data minimisation, PDPL Art. 11(3) and 29(2)(c); see الوثائق/04_الخصوصية_والأمن.md).
// Masking is minimisation, not anonymisation: names and other context stay, so person names are
// only flagged (nameHints) for the reader, never silently trusted as removed.

export type RedactKind =
  | "email" | "iban" | "card" | "account" | "passport" | "deed" | "birth" | "address" | "phone" | "id";
export type Redaction = { text: string; counts: Record<RedactKind, number>; total: number; nameHints: number };

const D = "[0-9٠-٩]";
const NOT_DIGIT_BEFORE = "(?<![0-9٠-٩])";
const NOT_DIGIT_AFTER = "(?![0-9٠-٩])";
// Not preceded or followed by another digit, so a digit run inside a longer number never matches.
const edge = (body: string) => new RegExp(`${NOT_DIGIT_BEFORE}${body}${NOT_DIGIT_AFTER}`, "g");
// A value that follows its Arabic label («رقم الحساب 6080…»): the label stays, the value is masked.
const labelled = (label: string, value: string) => new RegExp(`(${label})(\\s*[:：]?\\s*)${value}`, "g");

// Order matters: labelled values first (an account number would otherwise read as a card), then the
// longer forms, so their digit runs are gone before the ID and phone rules look for ten digits.
const RULES: { kind: RedactKind; re: RegExp; mask: string; keepLabel?: boolean }[] = [
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, mask: "[بريد]" },
  { kind: "account", re: labelled("رقم الحساب|حساب رقم", `${D}(?:[ -]?${D}){7,19}${NOT_DIGIT_AFTER}`), mask: "[حساب]", keepLabel: true },
  { kind: "passport", re: labelled("جواز(?: السفر)?(?: رقم)?", `[A-Z]?${D}{6,9}${NOT_DIGIT_AFTER}`), mask: "[جواز]", keepLabel: true },
  { kind: "deed", re: labelled("(?:رقم )?(?:ال)?صك(?: رقم)?", `${D}{6,15}${NOT_DIGIT_AFTER}`), mask: "[صك]", keepLabel: true },
  { kind: "birth", re: labelled("(?:تاريخ )?(?:ال)?ميلاد|مواليد", `${D}{1,4}[/\\-.]${D}{1,2}[/\\-.]${D}{1,4}`), mask: "[تاريخ الميلاد]", keepLabel: true },
  // Any country's IBAN: two letters, two check digits, then 11 to 30 alphanumerics in groups.
  { kind: "iban", re: new RegExp(`\\b[A-Z]{2}${D}{2}(?:\\s?[A-Z0-9٠-٩]{4}){2,7}(?:\\s?[A-Z0-9٠-٩]{1,4})?${NOT_DIGIT_AFTER}`, "gi"), mask: "[آيبان]" },
  { kind: "card", re: edge(`${D}{4}(?:[ -]?${D}{4}){3}`), mask: "[بطاقة]" },
  // A 15-digit card only in its printed 4-6-5 form or with an Amex prefix, so a 15-digit reference
  // number is left alone.
  { kind: "card", re: edge(`(?:${D}{4}[ -]${D}{6}[ -]${D}{5}|3[47]${D}{13})`), mask: "[بطاقة]" },
  // Saudi national address: building number, street and district, city and a five-digit postal code.
  { kind: "address", re: new RegExp(`${NOT_DIGIT_BEFORE}${D}{4}\\s+[^،,\\n\\d]{2,40}[،,]\\s*[^،,\\n\\d]{2,40}[،,]\\s*[^،,\\n\\d]{2,30}\\s${D}{5}${NOT_DIGIT_AFTER}`, "g"), mask: "[عنوان]" },
  { kind: "phone", re: edge(`(?:(?:\\+|00)966\\s?|0)5${D}(?:[ -]?${D}){7}`), mask: "[جوال]" },
  // Other countries' numbers in international form (+971 50 123 4567, 0044 …).
  { kind: "phone", re: edge(`(?:\\+|00)(?!966)[1-9]${D}{0,2}(?:[ -]?${D}{1,4}){2,5}`), mask: "[جوال]" },
  // National ID or iqama: ten digits starting with 1 or 2, also spaced or dashed.
  { kind: "id", re: edge(`[12١٢](?:[ -]?${D}){9}`), mask: "[هوية]" },
];

// A title or role followed by a name with a patronymic or family particle («محمد بن عبدالله»,
// «خالد آل سعود»): flagged for the reader, not masked (names cannot be detected reliably).
const NAME_HINT = /(?:السيد|السيدة|العميل|العميلة|المقترض|المستفيد|الكفيل|الشاهد|المشتري|المستأجر)\s+[ء-ي]{2,}\s+(?:بن|بنت|ابن|آل)\s+[ء-ي]{2,}/g;

export function redact(input: string): Redaction {
  const counts = Object.fromEntries(RULES.map((r) => [r.kind, 0])) as Record<RedactKind, number>;
  let text = input;
  for (const { kind, re, mask, keepLabel } of RULES)
    text = text.replace(re, (...m: string[]) => {
      counts[kind]++;
      return keepLabel ? `${m[1]}${m[2]}${mask}` : mask;
    });
  const nameHints = (input.match(NAME_HINT) ?? []).length;
  return { text, counts, total: Object.values(counts).reduce((a, b) => a + b, 0), nameHints };
}
