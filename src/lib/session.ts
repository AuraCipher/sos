import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless, cryptographically signed pin-authentication sessions.
 *
 * The session is a HMAC-SHA256 signature over a small JSON payload
 * ({ v: 1, exp }) carried in the cookie value. Verification recomputes
 * the signature with the server-side SOS_SESSION_SECRET and checks the
 * expiry. No database: the secret itself keeps the sessions forge-proof.
 *
 * The cookie is deliberately a browser *session* cookie: no Max-Age or
 * Expires, so it disappears when the browser closes.
 */

export const SESSION_COOKIE_NAME = "sos_session";

/** How long the signature remains valid, in seconds (12 hours). */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function createSessionCookieValue(sessionSecret: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }),
    "utf8",
  ).toString("base64url");

  const signature = createHmac("sha256", sessionSecret)
    .update(payload, "utf8")
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function verifySessionCookieValue(
  value: string | undefined | null,
  sessionSecret: string | null,
): boolean {
  if (sessionSecret === null || typeof value !== "string" || value === "") {
    return false;
  }

  const separator = value.indexOf(".");
  if (separator <= 0 || separator === value.length - 1) {
    return false;
  }
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  const expected = createHmac("sha256", sessionSecret)
    .update(payload, "utf8")
    .digest("base64url");
  const provided = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (
    provided.length !== expectedBuf.length ||
    !timingSafeEqual(provided, expectedBuf)
  ) {
    return false;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof decoded.exp === "number" && decoded.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

/** Build the Set-Cookie header value for the session cookie. */
export function sessionSetCookie(value: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/** Read the session value from a request's Cookie header. */
export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (header === null) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const equals = trimmed.indexOf("=");
    if (equals <= 0) {
      continue;
    }
    if (trimmed.slice(0, equals) === SESSION_COOKIE_NAME) {
      return trimmed.slice(equals + 1);
    }
  }
  return undefined;
}
