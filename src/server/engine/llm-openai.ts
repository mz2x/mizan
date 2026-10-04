// server-only: imported by node tests
// The same LlmCall contract over any OpenAI-compatible chat-completions server (vLLM, Ollama,
// LM Studio, a bank's internal gateway). It is how Mizan runs on a model the bank hosts: the
// pipeline, the code gate and abstention are unchanged; only the model behind `LlmCall` moves.
import { z } from "zod";
import type { LlmCall, LlmResult, Usage } from "./llm";

export type OpenAiCompatibleOptions = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** Per-attempt timeout when the call gives none (matches the Anthropic client default). */
  timeoutMs?: number;
};

type ChatResponse = {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** Some servers wrap JSON in a Markdown fence even in JSON mode. */
const unfence = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

export function makeOpenAiCompatibleLlm(opts: OpenAiCompatibleOptions): LlmCall {
  const url = `${opts.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const doFetch = opts.fetchImpl ?? fetch;
  return async <T,>({ system, user, schema, maxTokens = 8000, timeoutMs, signal }: Parameters<LlmCall>[0] & { schema: z.ZodType<T> }): Promise<LlmResult<T>> => {
    const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
    void _drop;
    const body = JSON.stringify({
      model: opts.model,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: jsonSchema } },
    });
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;

    // One retry at most, on a network failure or a 5xx, like the Anthropic client (maxRetries: 1).
    let res: Response | null = null;
    let detail = "";
    for (let attempt = 0; attempt < 2 && !res; attempt++) {
      const timeout = AbortSignal.timeout(timeoutMs ?? opts.timeoutMs ?? 45_000);
      try {
        const r = await doFetch(url, { method: "POST", headers, body, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
        if (r.status >= 500 && attempt === 0) {
          detail = `http ${r.status}`;
          continue;
        }
        res = r;
      } catch (e) {
        detail = (e as Error).message;
        if (signal?.aborted) break;
      }
    }
    if (!res) return { ok: false, reason: "api_error", detail };
    if (!res.ok) return { ok: false, reason: "api_error", detail: `http ${res.status}` };
    let data: ChatResponse;
    try {
      data = (await res.json()) as ChatResponse;
    } catch {
      return { ok: false, reason: "parse_error", detail: "response is not JSON" };
    }
    const choice = data.choices?.[0];
    if (choice?.message?.refusal) return { ok: false, reason: "refusal", detail: choice.message.refusal };
    if (choice?.finish_reason === "length") return { ok: false, reason: "max_tokens", detail: "output truncated" };
    const content = choice?.message?.content;
    if (!content) return { ok: false, reason: "parse_error", detail: "no content" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(unfence(content));
    } catch {
      return { ok: false, reason: "parse_error", detail: "content is not JSON" };
    }
    const checked = schema.safeParse(parsed);
    if (!checked.success) return { ok: false, reason: "parse_error", detail: "content does not match the schema" };
    const usage: Usage = { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0, cacheRead: 0, cacheWrite: 0 };
    return { ok: true, value: checked.data, usage };
  };
}
