import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
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

  it("lasts for the whole browser session: legacy expiry fields are ignored", () => {
    // Even a token carrying a long-past exp stays valid while the cookie
    // (a browser-session cookie) survives — expiry is not part of the
    // design; rotating the secret is the revocation mechanism.
    const legacy = makeToken(
      { v: 1, exp: Math.floor(Date.now() / 1000) - 5 },
      SECRET,
    );
    expect(verifySessionCookieValue(legacy, SECRET)).toBe(true);
  });

  it("rejects payloads without the current version marker", () => {
    expect(verifySessionCookieValue(makeToken({ v: 2 }, SECRET), SECRET)).toBe(
      false,
    );
    expect(verifySessionCookieValue(makeToken({}, SECRET), SECRET)).toBe(false);
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

  it("embeds no server-side expiry into the payload", () => {
    const token = createSessionCookieValue(SECRET);
    const payload = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    expect(payload).toEqual({ v: 1 });
    expect("exp" in payload).toBe(false);
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
