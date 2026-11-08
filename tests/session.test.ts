import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionSetCookie,
  verifySessionCookieValue,
} from "@/lib/session";

const SECRET = "test-session-secret-0123456789abcdef";

function makeToken(payload: object, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(data, "utf8")
    .digest("base64url");
  return `${data}.${signature}`;
}

describe("session tokens", () => {
  it("creates a token that verifies against the same secret", () => {
    const token = createSessionCookieValue(SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifySessionCookieValue(token, SECRET)).toBe(true);
  });

  it("rejects a different signing secret", () => {
    const token = createSessionCookieValue(SECRET);
    expect(verifySessionCookieValue(token, "another-secret")).toBe(false);
  });

  it("rejects tampered payloads", () => {
    const token = createSessionCookieValue(SECRET);
    const [payload, signature] = token.split(".");
    const shortened = payload.slice(0, -1);
    expect(verifySessionCookieValue(`${shortened}.${signature}`, SECRET)).toBe(
      false,
    );
  });

  it("rejects expired sessions", () => {
    const expired = makeToken(
      { v: 1, exp: Math.floor(Date.now() / 1000) - 5 },
      SECRET,
    );
    expect(verifySessionCookieValue(expired, SECRET)).toBe(false);
  });

  it("rejects garbage, empty, and missing values", () => {
    expect(verifySessionCookieValue("garbage", SECRET)).toBe(false);
    expect(verifySessionCookieValue("", SECRET)).toBe(false);
    expect(verifySessionCookieValue(undefined, SECRET)).toBe(false);
    expect(verifySessionCookieValue(null, SECRET)).toBe(false);
    expect(
      verifySessionCookieValue(createSessionCookieValue(SECRET), null),
    ).toBe(false);
  });

  it("embeds the documented session lifetime", () => {
    expect(SESSION_TTL_SECONDS).toBe(12 * 60 * 60);
    const token = createSessionCookieValue(SECRET);
    const payload = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
    ) as { exp: number };
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    expect(payload.exp).toBeLessThanOrEqual(
      Date.now() / 1000 + SESSION_TTL_SECONDS,
    );
  });
});

describe("session cookie construction", () => {
  it("is an HttpOnly SameSite=Strict browser-session cookie (no Max-Age)", () => {
    const insecure = sessionSetCookie("token-value", false);
    expect(insecure).toBe(
      `${SESSION_COOKIE_NAME}=token-value; Path=/; HttpOnly; SameSite=Strict`,
    );
    expect(insecure.includes("Max-Age")).toBe(false);
    expect(insecure.includes("Expires")).toBe(false);
  });

  it("adds Secure only in production", () => {
    const secure = sessionSetCookie("token-value", true);
    expect(secure.endsWith("; Secure")).toBe(true);
    expect(secure.includes("HttpOnly")).toBe(true);
  });
});
