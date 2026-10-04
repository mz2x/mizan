// server-only: imported by node scripts and the route handler
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/** Dev convenience: read ~/.config/mizan/.env when the key is not already in the environment. */
export function loadDevEnv(): void {
  if (process.env.ANTHROPIC_API_KEY) return;
  const file = path.join(homedir(), ".config", "mizan", ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
