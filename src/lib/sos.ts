/**
 * Shared SOS constants and API contract.
 *
 * Used by the UI (src/components/sos-panel.tsx) and the backend Route
 * Handler (src/app/api/sos/route.ts) so both sides agree on the same
 * endpoint, defaults, and response shapes.
 */

/** Where the UI sends SOS requests (a Next.js Route Handler). */
export const SOS_API_ENDPOINT = "/api/sos";

/** Fixed notification message, used whenever the user adds no message. */
export const DEFAULT_SOS_MESSAGE =
  "SOS: My Abu isn't coming today. Please pick me up!";

/** Seconds the backend enforces between successful SOS requests (2 minutes). */
export const SOS_COOLDOWN_SECONDS = 120;

/** Maximum length of the user's optional message. */
export const MAX_MESSAGE_LENGTH = 280;

export type SosSuccessResponse = {
  ok: true;
  /** Seconds the user must wait before sending another SOS. */
  cooldownSeconds: number;
};

export type SosErrorResponse = {
  ok: false;
  /** Short, human-readable explanation, shown directly to the user. */
  error: string;
  /** Present on HTTP 429: seconds left before the request may be retried. */
  retryAfterSeconds?: number;
};

export type SosResponse = SosSuccessResponse | SosErrorResponse;
