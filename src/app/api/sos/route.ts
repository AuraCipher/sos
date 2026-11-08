import { loadNtfyConfig, serverEnv } from "@/lib/env";
import {
  MAX_MESSAGE_LENGTH,
  composeSosMessage,
  sanitizeCustomMessage,
  type SosErrorResponse,
} from "@/lib/sos";
import { publishSosMessage } from "@/lib/ntfy";
import {
  readSessionCookie,
  verifySessionCookieValue,
} from "@/lib/session";

/**
 * POST /api/sos — publish a pickup request through ntfy.
 *
 * Every request is verified server-side against the signed session cookie
 * set by POST /api/auth/pin; frontend state is never trusted. The browser
 * may optionally add a custom message:
 *
 *   { "message": "..." }   // optional, max 280 characters
 *
 * The notification text is always the fixed line
 *   "SOS: My Abu isn't coming today. Please pick me up!"
 * with the custom message appended on its own line.
 *
 * The response reports success only after ntfy confirmed the publish; a
 * failed publish never claims an SOS was sent.
 */
export async function POST(request: Request): Promise<Response> {
  // 1. Configuration (fail clearly, without exposing values).
  const sessionSecret = serverEnv("SOS_SESSION_SECRET");
  if (sessionSecret === null) {
    return configErrorResponse(
      "Server configuration is incomplete: SOS_SESSION_SECRET is not set. Ask your friend to finish the setup.",
    );
  }
  const ntfyConfig = loadNtfyConfig();
  if (!ntfyConfig.ok) {
    return configErrorResponse(ntfyConfig.message);
  }

  // 2. Session verification (server-side, every request).
  if (!verifySessionCookieValue(readSessionCookie(request), sessionSecret)) {
    return Response.json(
      {
        ok: false,
        error:
          "Your session has expired. Please reload the page and enter your PIN again.",
      } satisfies SosErrorResponse,
      { status: 401 },
    );
  }

  // 3. Request validation.
  if (isRequestTooLarge(request)) {
    return Response.json(
      { ok: false, error: "The request is too large." } satisfies SosErrorResponse,
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON." } satisfies SosErrorResponse,
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return Response.json(
      { ok: false, error: "Request body must be a JSON object." } satisfies SosErrorResponse,
      { status: 400 },
    );
  }

  const rawMessage = (body as { message?: unknown }).message;
  if (rawMessage !== undefined && rawMessage !== null && typeof rawMessage !== "string") {
    return Response.json(
      {
        ok: false,
        error: "The optional message must be text.",
      } satisfies SosErrorResponse,
      { status: 400 },
    );
  }

  const custom = sanitizeCustomMessage(rawMessage);
  if (custom.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      {
        ok: false,
        error: `The optional message must be at most ${MAX_MESSAGE_LENGTH} characters.`,
      } satisfies SosErrorResponse,
      { status: 400 },
    );
  }

  // 4. Publish through ntfy and report honestly.
  const result = await publishSosMessage(composeSosMessage(custom));
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error } satisfies SosErrorResponse,
      { status: 502 },
    );
  }

  return Response.json({ ok: true } satisfies { ok: true }, { status: 200 });
}

function isRequestTooLarge(request: Request): boolean {
  const length = Number(request.headers.get("content-length") ?? "0");
  return Number.isFinite(length) && length > 8192;
}

function configErrorResponse(message: string): Response {
  return Response.json({ ok: false, error: message }, { status: 500 });
}
