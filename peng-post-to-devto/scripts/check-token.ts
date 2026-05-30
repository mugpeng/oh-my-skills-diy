#!/usr/bin/env bun

/**
 * Pre-flight check: verify DEVTO_TOKEN is valid.
 *
 * Usage: bun scripts/check-token.ts
 */

import { getToken } from "./token";

const API_BASE = "https://dev.to/api";

async function main() {
  const token = getToken();

  console.log("=== Dev.to Token Check ===\n");
  console.log("OK: DEVTO_TOKEN resolved.");

  try {
    const res = await fetch(`${API_BASE}/articles/me?per_page=1`, {
      headers: {
        "api-key": token,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const articles = await res.json();
      console.log(`OK: Token is valid. (${articles.length} article(s) found)\n`);
      console.log("All checks passed. Ready to publish!");
    } else if (res.status === 401) {
      console.log("FAIL: Token is invalid or expired.\n");
      console.log("To fix:");
      console.log("  1. Go to https://dev.to/settings/extensions");
      console.log("  2. Generate a new API key");
      console.log("  3. Update DEVTO_TOKEN in your environment or .env file");
      process.exit(1);
    } else {
      console.log(`WARN: Unexpected response (${res.status}). Token may still be valid.`);
    }
  } catch (err) {
    console.log("FAIL: Could not reach Dev.to API.\n");
    console.log("Possible causes:");
    console.log("  - No network connection");
    console.log("  - Sandbox/network restriction blocking dev.to");
    console.log("  - DNS resolution failure");
    console.log(`\nError: ${err instanceof Error ? err.message : String(err)}`);
    console.log("\nTo fix:");
    console.log("  - Check your internet connection");
    console.log("  - If in a sandboxed environment, ensure outbound HTTPS is allowed");
    process.exit(1);
  }
}

main();
