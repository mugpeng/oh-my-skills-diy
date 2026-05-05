#!/usr/bin/env bun

/**
 * Pre-flight check: verify DEVTO_TOKEN is valid.
 *
 * Usage: bun scripts/check-token.ts
 */

const API_BASE = "https://dev.to/api";

async function main() {
  const token = process.env.DEVTO_TOKEN;

  console.log("=== Dev.to Token Check ===\n");

  if (!token) {
    console.log("FAIL: DEVTO_TOKEN environment variable is not set.\n");
    console.log("To fix:");
    console.log("  1. Go to https://dev.to/settings/extensions");
    console.log('  2. Generate a new API key under "DEV Community API Keys"');
    console.log("  3. Add to your shell profile:");
    console.log('     export DEVTO_TOKEN="your_key_here"');
    console.log("\n  Or add to .peng-skills/.env:");
    console.log("     DEVTO_TOKEN=your_key_here");
    process.exit(1);
  }

  console.log("OK: DEVTO_TOKEN is set.");

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
    console.log("WARN: Could not reach Dev.to API. Check your network connection.");
    console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
