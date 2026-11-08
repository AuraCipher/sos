import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/pin/route";
import { resetPinThrottle } from "@/lib/pin-throttle";
import { verifySessionCookieValue } from "@/lib/session";

const ENV = {
  SOS_PIN: "246813",
  SOS_SESSION_SECRET: "test-session-secret-pin-route",
};

beforeEach(() => {
  resetPinThrottle();
  process.env.SOS_PIN = ENV.SOS_PIN;
  process.env.SOS_SESSION_SECRET = ENV.SOS_SESSION_SECRET;
});

describe("POST /api/auth/pin", () => {
  it("grants access for the correct PIN and sets a secure session cookie", async () => {
    const response = await POST(pinRequest("246813"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    const setCookie = response.headers.get("set-cookie") ?? "";
    // HttpOnly, SameSite=Strict, path-scoped; no persistent Max-Age/Expires.
    expect(/httponly/i.test(setCookie)).toBe(true);
    expect(/samesite=strict/i.test(setCookie)).toBe(true);
    expect(/path=\/(?=;|$)/i.test(setCookie)).toBe(true);
    expect(/max-age/i.test(setCookie)).toBe(false);
    expect(/expires=/i.test(setCookie)).toBe(false);

    // The value really is a valid session for the configured secret.
    const match = /sos_session=([^;]+)/.exec(setCookie);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBeDefined();
    expect(
      verifySessionCookieValue(match?.[1], ENV.SOS_SESSION_SECRET),
    ).toBe(true);
  });

  it("marks the cookie Secure when running in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    setNodeEnv("production");
    try {
      const setCookie = (await POST(pinRequest("246813")))
        .headers.get("set-cookie") ?? "";
      expect(/;\s*secure/i.test(setCookie)).toBe(true);
    } finally {
      setNodeEnv(previousNodeEnv);
    }
  });

  it("rejects an incorrect PIN with 401 and no session", async () => {
    const response = await POST(pinRequest("999999"));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Incorrect PIN.");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("reports a clear configuration error when SOS_PIN is not set", async () => {
    delete process.env.SOS_PIN;
    const response = await POST(pinRequest("246813"));

    expect(response.status).toBe(500);
    const body = (await response.json()) as { ok: false; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("SOS_PIN");
    // The response must never contain the PIN value itself.
    expect(body.error.includes(ENV.SOS_PIN)).toBe(false);
  });

  it("reports a clear configuration error when SOS_SESSION_SECRET is not set", async () => {
    delete process.env.SOS_SESSION_SECRET;
    const response = await POST(pinRequest("246813"));

    expect(response.status).toBe(500);
    const body = (await response.json()) as { ok: false; error: string };
    expect(body.error).toContain("SOS_SESSION_SECRET");
  });

  it("rejects malformed bodies without leaking anything", async () => {
    const butchered = new Request("http://localhost/api/auth/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const response = await POST(butchered);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it("rejects non-string and oversized PINs", async () => {
    const missingPin = await POST(
      new Request("http://localhost/api/auth/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(missingPin.status).toBe(400);

    const longPin = await POST(pinRequest("1".repeat(65)));
    expect(longPin.status).toBe(400);
  });

  it("throttles scripted hammering after repeated failures", async () => {
    // Six failures are tolerated per window; the seventh attempt from the
    // same key is throttled so storage-cleared scripts cannot spray the PIN.
    for (let i = 0; i < 6; i += 1) {
      const response = await POST(pinRequest("000000"));
      expect(response.status).toBe(401);
    }
    const seventh = await POST(pinRequest("000000"));
    expect(seventh.status).toBe(429);
    const seventhBody = (await seventh.json()) as { ok: boolean; error: string };
    expect(seventhBody.error).not.toContain(ENV.SOS_PIN);
  });
});

function pinRequest(pin: unknown): Request {
  return new Request("http://localhost:3000/api/auth/pin", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.9",
    },
    body: JSON.stringify({ pin }),
  });
}

// @types/node marks NODE_ENV readonly; the route reads it at call time.
function setNodeEnv(value: string | undefined): void {
  (process.env as unknown as { NODE_ENV?: string }).NODE_ENV = value;
}
