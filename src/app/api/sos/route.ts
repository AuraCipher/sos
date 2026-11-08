import { MAX_MESSAGE_LENGTH, type SosErrorResponse } from "@/lib/sos";

/**
 * POST /api/sos — receives a pickup request from the SOS page.
 *
 * Planned flow (ntfy integration pending):
 *   1. Validate the JSON body.
 *   2. Enforce a 2-minute (120 s) cooldown between sends; respond 429 with
 *      `{ ok: false, error, retryAfterSeconds }` while waiting.
 *   3. Publish the notification through the ntfy.sh REST API using the
 *      fixed default message plus the user's optional message.
 *
 * The ntfy topic, optional token, and server URL come only from server-side
 * env vars (see .env.example) and are never sent to the browser.
 *
 * Current stage: validation skeleton only. Requests that pass validation get
 * an honest 501 answered `{ ok: false, error }` — no notification is claimed
 * or attempted until the integration is implemented.
 */
export async function POST(request: Request): Promise<Response> {
  const json = (body: SosErrorResponse, status: number): Response =>
    Response.json(body, { status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Request body must be valid JSON." }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return json({ ok: false, error: "Request body must be a JSON object." }, 400);
  }

  const { message } = body as { message?: unknown };
  if (typeof message === "string" && message.length > MAX_MESSAGE_LENGTH) {
    return json(
      {
        ok: false,
        error: `The optional message must be at most ${MAX_MESSAGE_LENGTH} characters.`,
      },
      400,
    );
  }

  // TODO(sos): Enforce the 2-minute cooldown. Reject repeats with:
  //   json({ ok: false, error: "...", retryAfterSeconds: secondsLeft }, 429)
  // TODO(sos): Publish to ntfy.sh (PUT, Title + Message + Priority headers,
  //            Authorization only when NTFY_AUTH_TOKEN is set), then answer:
  //   Response.json({ ok: true, cooldownSeconds: 120 })

  return json(
    {
      ok: false,
      error:
        "The pickup service is not connected yet. Please ask your friend to finish the setup.",
    },
    501,
  );
}
