import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { CLIENT_OPTIONS, makeLlm } from "./llm";

const fake = (response: unknown, throws?: Error) =>
  ({ messages: { parse: async () => { if (throws) throw throws; return response; } } }) as never;
const schema = z.object({ word: z.string() });
const args = { system: "s".repeat(600), user: "u", schema, effort: "low" as const };
const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

test("returns parsed value", async () => {
  const r = await makeLlm(fake({ stop_reason: "end_turn", parsed_output: { word: "ميزان" }, usage }))(args);
  assert.deepEqual(r, { ok: true, value: { word: "ميزان" }, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } });
});

test("refusal is a typed failure", async () => {
  const r = await makeLlm(fake({ stop_reason: "refusal", parsed_output: null, usage, stop_details: { category: "x" } }))(args);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, "refusal");
});

test("thrown API error is a typed failure, never a throw", async () => {
  const r = await makeLlm(fake(null, new Error("429 rate limited")))(args);
  assert.equal(!r.ok && r.reason, "api_error");
});

// Final fix wave, item 1: every call is bounded. The per-call timeout and the pipeline's abort
// signal travel to the SDK as request options (the second argument of messages.parse).
const capturing = () => {
  const seen: { body: unknown; options: Record<string, unknown> | undefined }[] = [];
  const client = {
    messages: {
      parse: async (body: unknown, options?: Record<string, unknown>) => {
        seen.push({ body, options });
        return { stop_reason: "end_turn", parsed_output: { word: "ميزان" }, usage };
      },
    },
  } as never;
  return { client, seen };
};

test("timeoutMs and signal are passed through to parse as request options", async () => {
  const { client, seen } = capturing();
  const signal = new AbortController().signal;
  await makeLlm(client)({ ...args, timeoutMs: 90_000, signal });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].options?.timeout, 90_000);
  assert.equal(seen[0].options?.signal, signal);
});

test("without timeoutMs no timeout key is sent, so the client default (45 s) applies", async () => {
  const { client, seen } = capturing();
  await makeLlm(client)(args);
  // The SDK validates `timeout` whenever the key is present, so an undefined value must not be sent.
  assert.ok(!("timeout" in (seen[0].options ?? {})));
  assert.ok(!("signal" in (seen[0].options ?? {})));
});

test("the default client is bounded: one retry, 45 s per request", () => {
  assert.deepEqual(CLIENT_OPTIONS, { maxRetries: 1, timeout: 45_000 });
});
