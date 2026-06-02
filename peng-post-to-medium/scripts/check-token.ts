#!/usr/bin/env bun

/**
 * Pre-flight check: verify MEDIUM_TOKEN is valid.
 *
 * Usage: bun scripts/check-token.ts
 */

import { getToken } from "./token";

const API_BASE = "https://api.medium.com/v1";

async function main() {
  const token = getToken();

  console.log("=== Medium Token Check ===\n");
  console.log("OK: MEDIUM_TOKEN resolved.");

  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const user = data.data;
      console.log(`OK: Token is valid.`);
      console.log(`  User:    ${user.name}`);
      console.log(`  ID:      ${user.id}`);
      console.log(`  URL:     ${user.url}`);
      console.log("\nAll checks passed. Ready to publish!");
    } else if (res.status === 401) {
      console.log("FAIL: Token is invalid or expired.\n");
      console.log("To fix:");
      console.log("  1. Go to https://medium.com/me/settings");
      console.log("  2. Navigate to 'Integration tokens'");
      console.log("  3. Generate a new token (give it a descriptive name)");
      console.log("  4. Update MEDIUM_TOKEN in your environment or .env file");
      process.exit(1);
    } else {
      console.log(`WARN: Unexpected response (${res.status}). Token may still be valid.`);
    }
  } catch (err) {
    console.log("FAIL: Could not reach Medium API.\n");
    console.log("Possible causes:");
    console.log("  - No network connection");
    console.log("  - Sandbox/network restriction blocking api.medium.com");
    console.log("  - DNS resolution failure");
    console.log(`\nError: ${err instanceof Error ? err.message : String(err)}`);
    console.log("\nTo fix:");
    console.log("  - Check your internet connection");
    console.log("  - If in a sandboxed environment, ensure outbound HTTPS is allowed");
    process.exit(1);
  }
}

main();
