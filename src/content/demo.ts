// Demonstration clauses. They are authored for the demo (عقد توضيحي), not taken from a real
// bank contract. Each verdict must stay true to the cited committee unit in `units.ts`.
import type { Verdict } from "@/lib/review-types";
export type { Verdict };

export type DemoClause = {
  serial: string;
  verdict: Verdict;
  citation: string | null;
  text: { ar: string; en: string };
};

export const HERO_CLAUSES: DemoClause[] = [
  {
    serial: "0007321",
    verdict: "nonCompliant",
    citation: "الإنماء/ق7/ثالثاً/2",
    text: {
      ar: "يشتري المصرف من العميل السلعة المملوكة له بثمن حال، ثم يبيعها عليه بالأجل",
      en: "The bank buys the goods the client owns for cash, then sells them back to the client on deferred terms",
    },
  },
  {
    // ق209/أولاً puts insurance on the lessor in an ijara; whether it binds here depends on
    // the contract type, so the honest outcome is escalation, not a verdict.
    serial: "0007322",
    verdict: "review",
    citation: "الإنماء/ق209/أولاً",
    text: {
      ar: "يلتزم العميل بالتأمين على السلعة لدى جهة يحددها المصرف",
      en: "The client insures the goods with a provider the bank selects",
    },
  },
  {
    // No unit in the corpus mentions digital currencies (checked 2026-09-30), so Mizan abstains.
    serial: "0007323",
    verdict: "abstain",
    citation: null,
    text: {
      ar: "يحق للعميل سداد الأقساط بالعملات الرقمية",
      en: "The client may pay installments in digital currencies",
    },
  },
];
