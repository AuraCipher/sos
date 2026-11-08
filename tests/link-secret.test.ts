import { describe, expect, it } from "vitest";
import { isLinkSecretMatch } from "@/lib/link-secret";

const LINK_SECRET = "correct-horse-secret-abcdef0123456789";

describe("private-link secret check", () => {
  it("accepts the exact secret", () => {
    expect(isLinkSecretMatch(LINK_SECRET, LINK_SECRET)).toBe(true);
  });

  it("rejects wrong, near-miss, and missing candidates", () => {
    expect(isLinkSecretMatch("wrong-secret", LINK_SECRET)).toBe(false);
    expect(isLinkSecretMatch(LINK_SECRET.slice(0, -1), LINK_SECRET)).toBe(false);
    expect(isLinkSecretMatch(`x${LINK_SECRET}`, LINK_SECRET)).toBe(false);
    expect(isLinkSecretMatch("", LINK_SECRET)).toBe(false);
    expect(isLinkSecretMatch(undefined, LINK_SECRET)).toBe(false);
    expect(isLinkSecretMatch(LINK_SECRET, "different-env-secret")).toBe(false);
  });
});
