// server-only: imported by node tests
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { makeOpenAiCompatibleLlm } from "./llm-openai";

/** The default model. A deployment overrides it with MIZAN_LLM_MODEL (see `llmConfig`). */
export const MODEL = "claude-sonnet-5-5";
export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type LlmResult<T> =
  | { ok: true; value: T; usage: Usage }
  | { ok: false; reason: "refusal" | "max_tokens" | "api_error" | "parse_error"; detail: string };
export type LlmCall = <T>(args: {
  system: string; user: string; schema: z.ZodType<T>; effort: "low" | "medium" | "high"; maxTokens?: number;
  /** Per-request timeout; without it the client default (`CLIENT_OPTIONS.timeout`) applies. */
  timeoutMs?: number;
  /** Aborts the in-flight request (the pipeline's signal, or a per-clause deadline). */
  signal?: AbortSignal;
}) => Promise<LlmResult<T>>;

/** Every request is bounded: one retry at most, 45 s per attempt unless the call asks for more. */
export const CLIENT_OPTIONS = { maxRetries: 1, timeout: 45_000 } as const;

type UsageIn = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
const toUsage = (u: UsageIn): Usage => ({
  input: u.input_tokens, output: u.output_tokens,
  cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0,
});

export function makeLlm(client: Anthropic = new Anthropic({ ...CLIENT_OPTIONS }), model = MODEL): LlmCall {
  return async ({ system, user, schema, effort, maxTokens = 8000, timeoutMs, signal }) => {
    // The SDK validates `timeout` whenever the key is present, so only set the keys that have values.
    const options: { timeout?: number; signal?: AbortSignal } = {};
    if (timeoutMs !== undefined) options.timeout = timeoutMs;
    if (signal) options.signal = signal;
    try {
      const res = await client.messages.parse({
        model,
        max_tokens: maxTokens,
        // The stable system prompt is the cached prefix; the clause goes after it.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        output_config: { effort, format: zodOutputFormat(schema) },
        messages: [{ role: "user", content: user }],
      }, options);
      if (res.stop_reason === "refusal") return { ok: false, reason: "refusal", detail: JSON.stringify(res.stop_details ?? null) };
      if (res.stop_reason === "max_tokens") return { ok: false, reason: "max_tokens", detail: "output truncated" };
      if (res.parsed_output == null) return { ok: false, reason: "parse_error", detail: "no parsed output" };
      return { ok: true, value: res.parsed_output, usage: toUsage(res.usage) };
    } catch (e) {
      return { ok: false, reason: "api_error", detail: (e as Error).message };
    }
  };
}

export type LlmProvider = "anthropic" | "openai";
export type LlmConfig = { provider: LlmProvider; model: string; baseUrl?: string; apiKey?: string };

/** Which model the engine talks to, from the environment. Nothing set means Claude Sonnet 5.5 through
 *  Anthropic, as today.
 *  - MIZAN_LLM_PROVIDER: `anthropic` (default) or `openai`, meaning any OpenAI-compatible server
 *    (vLLM, Ollama, LM Studio, an internal gateway).
 *  - MIZAN_LLM_MODEL: the model name that server knows, e.g. `Qwen/Qwen3.8-27B`.
 *  - MIZAN_LLM_BASE_URL: the server's base URL, e.g. `http://llm.bank.internal/v1`; required for
 *    `openai`, and optional for `anthropic`, where it points the SDK at a proxy.
 *  - MIZAN_LLM_API_KEY: optional bearer key for `openai` (Anthropic keeps ANTHROPIC_API_KEY). */
export function llmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const provider = (env.MIZAN_LLM_PROVIDER ?? "anthropic").trim().toLowerCase();
  if (provider !== "anthropic" && provider !== "openai") throw new Error(`MIZAN_LLM_PROVIDER must be anthropic or openai, got ${provider}`);
  const baseUrl = env.MIZAN_LLM_BASE_URL?.trim() || undefined;
  if (provider === "openai" && !baseUrl) throw new Error("MIZAN_LLM_BASE_URL is required when MIZAN_LLM_PROVIDER=openai");
  if (provider === "openai" && !env.MIZAN_LLM_MODEL?.trim()) throw new Error("MIZAN_LLM_MODEL is required when MIZAN_LLM_PROVIDER=openai");
  return { provider, model: env.MIZAN_LLM_MODEL?.trim() || MODEL, baseUrl, apiKey: env.MIZAN_LLM_API_KEY?.trim() || undefined };
}

/** The engine's model, as configured. */
export function makeConfiguredLlm(config: LlmConfig = llmConfig()): LlmCall {
  if (config.provider === "openai") return makeOpenAiCompatibleLlm({ baseUrl: config.baseUrl!, model: config.model, apiKey: config.apiKey });
  return makeLlm(new Anthropic({ ...CLIENT_OPTIONS, ...(config.baseUrl ? { baseURL: config.baseUrl } : {}) }), config.model);
}
