import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/sos/route";
import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import {
  DEFAULT_SOS_MESSAGE,
  SOS_NOTIFICATION_TITLE,
} from "@/lib/sos";

const TEST_SESSION_SECRET = "test-session-secret-sos-route";
const TEST_TOPIC = "test-topic-do-not-use";
const TEST_SERVER = "https://ntfy.example";
const TEST_TOKEN = "tk_test_do_not_use";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.SOS_SESSION_SECRET = TEST_SESSION_SECRET;
  process.env.NTFY_TOPIC = TEST_TOPIC;
  process.env.NTFY_SERVER_URL = TEST_SERVER;
  process.env.NTFY_PRIORITY = "urgent";
  delete process.env.NTFY_AUTH_TOKEN;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ id: "mocked" }), { status: 200 }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SOS_SESSION_SECRET;
  delete process.env.NTFY_TOPIC;
  delete process.env.NTFY_SERVER_URL;
  delete process.env.NTFY_PRIORITY;
  delete process.env.NTFY_AUTH_TOKEN;
});

describe("POST /api/sos", () => {
  it("rejects unauthenticated requests without touching ntfy", async () => {
    const response = await POST(sosRequest({}, undefined));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
  });

  it("rejects a tampered session cookie", async () => {
    const bearer = createSessionCookieValue(TEST_SESSION_SECRET);
    const tampered = `${bearer.slice(0, -2)}zz`;
    const response = await POST(sosRequest({}, tampered));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("publishes the fixed message when no custom message is sent", async () => {
    const response = await POST(
      sosRequest({}, authenticatedCookie()),
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as { ok: boolean }).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TEST_SERVER}/${TEST_TOPIC}`);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Priority).toBe("urgent");
    // Assert against the constant so wording edits in src/lib/sos.ts
    // never break the suite.
    expect(headers.Title).toBe(SOS_NOTIFICATION_TITLE);
    expect(headers.Authorization).toBeUndefined();
    expect(String(init.body)).toBe(DEFAULT_SOS_MESSAGE);
  });

  it("treats a whitespace-only custom message as no message", async () => {
    const response = await POST(
      sosRequest({ message: "   \n\t  " }, authenticatedCookie()),
    );
    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][1].body)).toBe(DEFAULT_SOS_MESSAGE);
  });

  it("appends the custom message to the fixed one", async () => {
    await POST(
      sosRequest(
        { message: "Ready at the main gate — class ends 4PM." },
        authenticatedCookie(),
      ),
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toBe(
      `${DEFAULT_SOS_MESSAGE}\nReady at the main gate — class ends 4PM.`,
    );
    void url; // URL covered by the fixed-message test
  });

  it("strips control characters from the custom message", async () => {
    await POST(
      sosRequest(
        { message: "Hidden\u0000secrets\u0007here" },
        authenticatedCookie(),
      ),
    );
    expect(String(fetchMock.mock.calls[0][1].body)).toBe(
      `${DEFAULT_SOS_MESSAGE}\nHiddensecretshere`,
    );
  });

  it("rejects messages longer than 280 characters", async () => {
    const response = await POST(
      sosRequest({ message: "x".repeat(281) }, authenticatedCookie()),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.error).toContain("280");
  });

  it("still accepts a 280-character message", async () => {
    const response = await POST(
      sosRequest({ message: "x".repeat(280) }, authenticatedCookie()),
    );
    expect(response.status).toBe(200);
  });

  it("sends the bearer token only when configured", async () => {
    process.env.NTFY_AUTH_TOKEN = TEST_TOKEN;
    await POST(sosRequest({}, authenticatedCookie()));

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it("reports an honest failure when ntfy rejects the publish", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const response = await POST(sosRequest({}, authenticatedCookie()));

    expect(response.status).toBe(502);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("rejected");
  });

  it("reports an honest failure when ntfy cannot be reached", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const response = await POST(sosRequest({}, authenticatedCookie()));

    expect(response.status).toBe(502);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Could not reach");
  });

  it("returns a configuration error without leaking values", async () => {
    delete process.env.NTFY_TOPIC;
    const response = await POST(sosRequest({}, authenticatedCookie()));

    expect(response.status).toBe(500);
    const body = (await response.json()) as { ok: false; error: string };
    expect(body.error).toContain("NTFY_TOPIC");
    expect(body.error.includes(TEST_TOPIC)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function sosRequest(body: unknown, cookie: string | undefined): Request {
  return new Request("http://localhost:3000/api/sos", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie !== undefined ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function authenticatedCookie(): string {
  return `${SESSION_COOKIE_NAME}=${createSessionCookieValue(TEST_SESSION_SECRET)}`;
}
