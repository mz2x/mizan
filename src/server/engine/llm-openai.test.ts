import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { makeOpenAiCompatibleLlm } from "./llm-openai";
import { llmConfig, MODEL } from "./llm";

const schema = z.object({ word: z.string(), n: z.number().nullable() });
const args = { system: "sys", user: "usr", schema, effort: "low" as const };
const reply = (content: string | null, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop", ...extra }], usage: { prompt_tokens: 7, completion_tokens: 3 } }), { status: 200 });

test("openai-compatible: posts a strict JSON schema and returns the validated value", async () => {
  const seen: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    return reply('{"word":"ميزان","n":null}');
  }) as typeof fetch;
  const llm = makeOpenAiCompatibleLlm({ baseUrl: "http://llm.local/v1/", model: "Qwen/Qwen3.8-27B", apiKey: "k", fetchImpl });
  const r = await llm(args);
  assert.deepEqual(r, { ok: true, value: { word: "ميزان", n: null }, usage: { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 } });
  assert.equal(seen[0].url, "http://llm.local/v1/chat/completions");
  assert.equal(seen[0].body.model, "Qwen/Qwen3.8-27B");
  assert.equal(seen[0].headers.authorization, "Bearer k");
  const rf = seen[0].body.response_format as { type: string; json_schema: { strict: boolean; schema: Record<string, unknown> } };
  assert.equal(rf.type, "json_schema");
  assert.equal(rf.json_schema.strict, true);
  assert.ok(!("$schema" in rf.json_schema.schema));
});

test("openai-compatible: a fenced reply is accepted; a reply off the schema is a parse_error", async () => {
  const fenced = makeOpenAiCompatibleLlm({ baseUrl: "http://x", model: "m", fetchImpl: (async () => reply('```json\n{"word":"a","n":1}\n```')) as typeof fetch });
  assert.equal((await fenced(args)).ok, true);
  const wrong = makeOpenAiCompatibleLlm({ baseUrl: "http://x", model: "m", fetchImpl: (async () => reply('{"word":5}')) as typeof fetch });
  const r = await wrong(args);
  assert.equal(!r.ok && r.reason, "parse_error");
});

test("openai-compatible: truncation, refusal and HTTP errors are typed failures, never throws", async () => {
  const cut = makeOpenAiCompatibleLlm({ baseUrl: "http://x", model: "m", fetchImpl: (async () => reply("{", { finish_reason: "length" })) as typeof fetch });
  assert.equal(((await cut(args)) as { reason: string }).reason, "max_tokens");
  const no = makeOpenAiCompatibleLlm({ baseUrl: "http://x", model: "m", fetchImpl: (async () => new Response(JSON.stringify({ choices: [{ message: { content: null, refusal: "no" } }] }))) as typeof fetch });
  assert.equal(((await no(args)) as { reason: string }).reason, "refusal");
  let calls = 0;
  const down = makeOpenAiCompatibleLlm({ baseUrl: "http://x", model: "m", fetchImpl: (async () => { calls++; return new Response("x", { status: 503 }); }) as typeof fetch });
  assert.equal(((await down(args)) as { reason: string }).reason, "api_error");
  assert.equal(calls, 2, "one retry on a 5xx");
  const boom = makeOpenAiCompatibleLlm({ baseUrl: "http://x", model: "m", fetchImpl: (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch });
  assert.equal(((await boom(args)) as { reason: string }).reason, "api_error");
});

test("llmConfig: nothing set is Claude through Anthropic; openai needs a base URL and a model", () => {
  assert.deepEqual(llmConfig({}), { provider: "anthropic", model: MODEL, baseUrl: undefined, apiKey: undefined });
  assert.deepEqual(llmConfig({ MIZAN_LLM_PROVIDER: "openai", MIZAN_LLM_BASE_URL: "http://h/v1", MIZAN_LLM_MODEL: "zai-org/GLM-5.3-Flash" }), {
    provider: "openai", model: "zai-org/GLM-5.3-Flash", baseUrl: "http://h/v1", apiKey: undefined,
  });
  assert.throws(() => llmConfig({ MIZAN_LLM_PROVIDER: "openai", MIZAN_LLM_MODEL: "m" }));
  assert.throws(() => llmConfig({ MIZAN_LLM_PROVIDER: "openai", MIZAN_LLM_BASE_URL: "http://h" }));
  assert.throws(() => llmConfig({ MIZAN_LLM_PROVIDER: "gemini" }));
});
