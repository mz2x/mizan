import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { loadDevEnv } from "../src/server/env";

loadDevEnv();
const client = new Anthropic();
const res = await client.messages.parse({
  model: "claude-sonnet-5-5",
  max_tokens: 2000,
  output_config: { effort: "low", format: zodOutputFormat(z.object({ word: z.string() })) },
  messages: [{ role: "user", content: "أعد كلمة «ميزان» في الحقل word." }],
});
console.log(res.stop_reason, res.parsed_output, res.usage);
