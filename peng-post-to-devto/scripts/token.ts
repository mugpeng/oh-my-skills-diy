/**
 * Shared token resolution for Dev.to API scripts.
 *
 * Lookup order:
 *   1. process.env.DEVTO_TOKEN
 *   2. <skillDir>/../.peng-skills/.env
 *   3. $HOME/.peng-skills/.env
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";

export function getToken(): string {
  // 1. Environment variable
  const envToken = process.env.DEVTO_TOKEN;
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
      const match = content.match(/DEVTO_TOKEN=(.+)/);
      if (match) return match[1].trim();
    } catch {}
  }

  // Not found — print recovery guidance and exit
  console.error("Error: DEVTO_TOKEN not found.\n");
  console.error("Checked:");
  console.error("  1. Environment variable DEVTO_TOKEN");
  console.error("  2. <skill>/.peng-skills/.env");
  console.error(`  3. ${resolve(process.env.HOME || "~", ".peng-skills", ".env")}`);
  console.error("\nTo fix:");
  console.error("  export DEVTO_TOKEN=\"your_key\"");
  console.error("  Or add DEVTO_TOKEN=<key> to ~/.peng-skills/.env");
  console.error("  See references/api-setup.md for full setup guide.");
  process.exit(1);
}
