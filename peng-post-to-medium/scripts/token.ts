/**
 * Shared token resolution for Medium API scripts.
 *
 * Lookup order:
 *   1. process.env.MEDIUM_TOKEN
 *   2. <skillDir>/../.peng-skills/.env
 *   3. $HOME/.peng-skills/.env
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";

export function getToken(): string {
  // 1. Environment variable
  const envToken = process.env.MEDIUM_TOKEN;
  if (envToken) return envToken;

  // 2. Skill-relative .peng-skills/.env
  const skillDir = dirname(new URL(import.meta.url).pathname);
  const envPaths = [
    resolve(skillDir, "..", ".peng-skills", ".env"),
    resolve(process.env.HOME || "~", ".peng-skills", ".env"),
  ];

  for (const p of envPaths) {
    try {
      const content = readFileSync(p, "utf-8");
      const match = content.match(/MEDIUM_TOKEN=(.+)/);
      if (match) return match[1].trim();
    } catch {}
  }

  // Not found — print recovery guidance and exit
  console.error("Error: MEDIUM_TOKEN not found.\n");
  console.error("Checked:");
  console.error("  1. Environment variable MEDIUM_TOKEN");
  console.error("  2. <skill>/.peng-skills/.env");
  console.error(`  3. ${resolve(process.env.HOME || "~", ".peng-skills", ".env")}`);
  console.error("\nTo fix:");
  console.error("  export MEDIUM_TOKEN=\"your_integration_token\"");
  console.error("  Or add MEDIUM_TOKEN=<token> to ~/.peng-skills/.env");
  console.error("  See references/api-setup.md for full setup guide.");
  process.exit(1);
}
