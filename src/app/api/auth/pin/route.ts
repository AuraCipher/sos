import { loadPinConfig, type ServerConfigResult, type PinConfig } from "@/lib/env";
import { clientKeyFromRequest, isPinThrottled, registerPinFailure } from "@/lib/pin-throttle";
import { constantTimeHashEquals } from "@/lib/secure-compare";
import {
  createSessionCookieValue,
  sessionSetCookie,
} from "@/lib/session";

/**
 * POST /api/auth/pin — validate the PIN and start a signed session.
 *
 * - The PIN is compared with SOS_PIN on the server only; it is never echoed
 *   back, logged, or stored.
 * - On success the response sets a HttpOnly, SameSite=Strict session cookie
 *   (Secure in production). The cookie carries no Max-Age/Expires, so the
 *   browser drops it when the browser closes.
 * - On failure the endpoint answers 401. A small in-memory throttle slows
 *   scripted hammering; the main progressive lockout table lives in the
 *   friend's browser (see src/lib/lockout.ts).
 */
export async function POST(request: Request): Promise<Response> {
  const config: ServerConfigResult<PinConfig> = loadPinConfig();
  if (!config.ok) {
    return configErrorResponse(config.message);
  }

  if (isRequestTooLarge(request)) {
    return json({ ok: false, error: "The request is too large." }, 413);
  }

  let pin: unknown;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("pin" in body)) {
      pin = undefined;
    } else {
      pin = (body as { pin: unknown }).pin;
    }
  } catch {
    pin = undefined;
  }

  if (typeof pin !== "string" || pin.length === 0 || pin.length > 64) {
    return json(
      {
        ok: false,
        error: "Enter your PIN and submit it again.",
      },
      400,
    );
  }

  const clientKey = clientKeyFromRequest(request);
  const now = Date.now();
  if (isPinThrottled(clientKey, now)) {
    // Same generic shape as a wrong PIN: no information to enumerate with.
    registerPinFailure(clientKey, now);
    return json(
      {
        ok: false,
        error: "Too many attempts from this device. Wait a little and try again.",
      },
      429,
    );
  }

  if (!constantTimeHashEquals(pin, config.value.pin)) {
    registerPinFailure(clientKey, now);
    return json({ ok: false, error: "Incorrect PIN." }, 401);
  }

  const secure = process.env.NODE_ENV === "production";
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionSetCookie(
        createSessionCookieValue(config.value.sessionSecret),
        secure,
      ),
    },
  });
}

function isRequestTooLarge(request: Request): boolean {
  const length = Number(request.headers.get("content-length") ?? "0");
  return Number.isFinite(length) && length > 8192;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function configErrorResponse(message: string): Response {
  return json({ ok: false, error: message }, 500);
}
