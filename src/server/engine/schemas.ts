// server-only: imported by node tests
import { z } from "zod";

export const EnrichmentSchema = z.object({
  kind: z.enum(["prohibition", "condition", "permission", "procedure", "approval_only"]),
  scope: z.array(z.string()),
  contract_phrasings: z.array(z.string()),
  aaoifi_only: z.boolean(),
});

export const SplitSchema = z.object({ clauses: z.array(z.string()) });

export const QuerySchema = z.object({ terms: z.array(z.string()), product: z.string().nullable() });

export const JudgeSchema = z.object({
  verdict: z.enum(["nonCompliant", "review", "abstain", "compliant"]),
  citations: z.array(
    z.object({ id: z.string(), quote: z.string(), role: z.enum(["governs", "supports", "related"]) }),
  ),
  scope_applies: z.boolean(),
  reason_ar: z.string(),
  reason_en: z.string(),
  suggestion_ar: z.string().nullable(),
  suggestion_en: z.string().nullable(),
});
export type Judgement = z.infer<typeof JudgeSchema>;

/** What each split segment is (structure.ts): a clause to review, an intro that introduces the
 *  items after it, or text that is not a clause at all. */
export const StructureSchema = z.object({
  items: z.array(
    z.object({
      i: z.number().int(),
      kind: z.enum(["clause", "intro", "other"]),
      other_type: z.enum(["title", "source", "separator", "parties", "definition", "signature", "fragment", "note"]).nullable(),
      context: z.array(z.number().int()),
    }),
  ),
});
export type Structure = z.infer<typeof StructureSchema>;
