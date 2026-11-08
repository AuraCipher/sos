/**
 * Shared SOS constants, request contract, and message composition.
 *
 * Safe to import from both server (src/app/api/*) and client
 * (src/components/*) code: this module contains no secrets. All secret
 * configuration (PINS, ntfy topic, tokens) lives in src/lib/env.ts and
 * stays server-side.
 */

/** Sign-in endpoint: validates the PIN and sets the session cookie. */
export const SOS_PIN_ENDPOINT = "/api/auth/pin";

/** Publishing endpoint: posts an SOS notification, requires a session. */
export const SOS_API_ENDPOINT = "/api/sos";

/** Fixed notification message, included in every SOS no matter what. */
export const DEFAULT_SOS_MESSAGE =
  "SOS: I need your help. Please contact me as soon as possible.";

/** Maximum length of the user's optional message (rejected beyond this). */
export const MAX_MESSAGE_LENGTH = 280;

/**
 * Browser-side cooldown between successful SOS requests, in seconds.
 * Convenience only: enforced in the browser via localStorage; nothing stops
 * a fresh browser or cleared storage from sending again. The server still
 * checks authentication and message validity every request.
 */
export const SOS_COOLDOWN_SECONDS = 30;

/** localStorage key holding the cooldown deadline (ms since epoch). */
export const SOS_COOLDOWN_STORAGE_KEY = "sos.cooldownUntil";

/** Notification title shown atop the ntfy Android notification. */
export const SOS_NOTIFICATION_TITLE = "SOS Signal";

export type SosSuccessResponse = {
  ok: true;
};

export type SosErrorResponse = {
  ok: false;
  /** Short, human-readable explanation, shown directly to the user. */
  error: string;
};

export type SosResponse = SosSuccessResponse | SosErrorResponse;

/**
 * Strip control characters (keeping newlines and tabs) and trim.
 * Empty string means: no custom message, send the fixed one only.
 */
export function sanitizeCustomMessage(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

/**
 * Compose the text pushed to ntfy: the fixed line first, then the friend's
 * optional message on its own line so the notification stays readable.
 */
export function composeSosMessage(custom: string): string {
  return custom === "" ? DEFAULT_SOS_MESSAGE : `${DEFAULT_SOS_MESSAGE}\n${custom}`;
}
