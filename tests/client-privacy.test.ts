import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: secrets must never reach browser-bound JavaScript.
 *
 * "use client" components are shipped to the browser verbatim, and any
 * module they import is bundled too. The modules listed here form the
 * browser-bound surface of the app; none of them may mention the server-only
 * environment variable names or reference public env plumbing.
 */
const BROWSER_BOUND_FILES = [
  // Client components
  "src/components/pin-gate.tsx",
  "src/components/sos-gate.tsx",
  "src/components/sos-panel.tsx",
  // Pure client-safe modules used by the components above
  "src/lib/sos.ts",
  "src/lib/lockout.ts",
  "src/lib/lockout-browser.ts",
  "src/lib/cooldown-browser.ts",
  "src/lib/browser-storage.ts",
  "src/lib/countdown.ts",
  // Public pages (server components, but scanned defensively)
  "src/app/page.tsx",
  "src/app/not-found.tsx",
  "src/app/layout.tsx",
];

const FORBIDDEN_ENV_PATTERN: [string, RegExp][] = [
  ["SOS_PIN", /\bSOS_PIN\b/],
  ["SOS_SESSION_SECRET", /\bSOS_SESSION_SECRET\b/],
  ["SOS_LINK_SECRET", /\bSOS_LINK_SECRET\b/],
  ["NTFY_TOPIC", /\bNTFY_TOPIC\b/],
  ["NTFY_SERVER_URL", /\bNTFY_SERVER_URL\b/],
  ["NTFY_AUTH_TOKEN", /\bNTFY_AUTH_TOKEN\b/],
  ["NTFY_PRIORITY", /\bNTFY_PRIORITY\b/],
  ["NEXT_PUBLIC_", /\bNEXT_PUBLIC_[A-Za-z0-9_]*/],
];

describe("frontend secret exposure", () => {
  it("never mentions server-side secret variables in browser-bound code", () => {
    for (const relativePath of BROWSER_BOUND_FILES) {
      const contents = readFileSync(join(process.cwd(), relativePath), "utf8");
      for (const [label, pattern] of FORBIDDEN_ENV_PATTERN) {
        expect(contents, `${relativePath} mentions ${label}`).not.toMatch(
          pattern,
        );
      }
    }
  });

  it("keeps the private-page gate server-side (no 'use client')", () => {
    const contents = readFileSync(
      join(process.cwd(), "src/components/private-sos-gate.tsx"),
      "utf8",
    );
    expect(contents.trimStart().startsWith('"use client"')).toBe(false);
    // It must be the only component that references the link secret.
    expect(contents).toContain("isLinkSecretMatch");
  });
});
