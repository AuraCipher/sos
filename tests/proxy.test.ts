import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Next.js 16 Proxy (src/proxy.ts) unit tests.
 *
 * "next/server" is mocked so the handler runs in plain Node: pass-through is
 * replaced with a sentinel and real 404s come back as plain web Responses.
 */

const passThroughs = vi.hoisted(() => ({ count: 0 }));

vi.mock("next/server", () => ({
  NextResponse: {
    next: () => {
      passThroughs.count += 1;
      return Symbol.for("test-next-response");
    },
  },
}));

import { config, proxy } from "@/proxy";

// next/server is mocked at runtime, so the handler runs in plain Node: only
// request.url is read, and tests hand it plain web Requests (cast below).
// The NextRequest type import is erased before the mock applies.

const SECRET = "proxy-test-secret-0123456789abcdef";

beforeEach(() => {
  process.env.SOS_LINK_SECRET = SECRET;
  passThroughs.count = 0;
});

afterEach(() => {
  delete process.env.SOS_LINK_SECRET;
});

async function proxyStatus(url: string): Promise<number | "next"> {
  const response = (await proxy(new Request(url) as unknown as NextRequest)) as
    | Response
    | symbol;
  if (typeof response === "symbol") {
    return "next";
  }
  return response.status;
}

describe("private-path proxy gate", () => {
  it("matcher is pinned to /private/** so other routes are untouched", () => {
    expect(config.matcher).toBe("/private/:path*");
  });

  it("passes the valid secret through to the page", async () => {
    expect(await proxyStatus(`http://localhost/private/${SECRET}`)).toBe(
      "next",
    );
    expect(passThroughs.count).toBe(1);
  });

  it("returns a real 404 for a wrong secret", async () => {
    expect(await proxyStatus("http://localhost/private/not-the-secret")).toBe(
      404,
    );
    expect(passThroughs.count).toBe(0);
  });

  it("returns a real 404 for near-miss and suffixed probes", async () => {
    expect(
      await proxyStatus(`http://localhost/private/${SECRET}x`),
    ).toBe(404);
    expect(
      await proxyStatus(`http://localhost/private/x${SECRET}`),
    ).toBe(404);
    expect(
      await proxyStatus(`http://localhost/private/${SECRET.slice(0, -1)}`),
    ).toBe(404);
  });

  it("understands percent-encoding in the URL segment", async () => {
    process.env.SOS_LINK_SECRET = "test secret with spaces";
    expect(
      await proxyStatus("http://localhost/private/test%20secret%20with%20spaces"),
    ).toBe("next");
  });

  it("tolerates a trailing slash on the valid path", async () => {
    expect(await proxyStatus(`http://localhost/private/${SECRET}/`)).toBe(
      "next",
    );
  });

  it("leaves multi-segment paths to the normal router 404", async () => {
    expect(
      await proxyStatus(`http://localhost/private/${SECRET}/extra`),
    ).toBe("next");
    expect(await proxyStatus("http://localhost/private/wrong/extra")).toBe(
      "next",
    );
  });

  it("returns a real 404 for the bare /private path", async () => {
    expect(await proxyStatus("http://localhost/private")).toBe(404);
    expect(await proxyStatus("http://localhost/private/")).toBe(404);
  });

  it("fails closed with a 404 when SOS_LINK_SECRET is not configured", async () => {
    delete process.env.SOS_LINK_SECRET;
    expect(await proxyStatus(`http://localhost/private/${SECRET}`)).toBe(404);
    expect(await proxyStatus("http://localhost/private/anything")).toBe(404);
    expect(passThroughs.count).toBe(0);
  });

  it("does not leak the secret in the 404 body", async () => {
    const response = (await proxy(
      new Request(`http://localhost/private/${SECRET}x`) as unknown as NextRequest,
    )) as Response;
    expect(await response.text()).not.toContain(SECRET);
  });
});
