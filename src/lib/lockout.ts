/**
 * PIN failed-attempt lockout (spec section 4).
 *
 * This lives entirely in the browser: attempts and the lock-deadline are
 * stored in localStorage. It is a friendly stagger, NOT a security
 * boundary — clearing browser storage or using another browser resets it.
 * The server independently verifies every PIN and additionally throttles
 * repeated failures per IP (src/lib/pin-throttle.ts).
 *
 * This module stays free of Node APIs so client components can import it.
 */

export const PIN_ATTEMPTS_STORAGE_KEY = "sos.pin.attempts";
export const PIN_LOCKED_UNTIL_STORAGE_KEY = "sos.pin.lockedUntil";

/**
 * Lockout duration in seconds after the Nth failed attempt.
 * 1-4 → none; 5 → 30 s; 6 → 1 min; 7 → 5 min; 8 → 15 min; 9 and up → 30 min.
 */
export function lockoutSecondsFor(failedAttempts: number): number | null {
  if (failedAttempts <= 4) {
    return null;
  }
  if (failedAttempts === 5) {
    return 30;
  }
  if (failedAttempts === 6) {
    return 60;
  }
  if (failedAttempts === 7) {
    return 300;
  }
  if (failedAttempts === 8) {
    return 900;
  }
  return 1800;
}

/**
 * Record one more failed attempt.
 * Returns the new attempt count and — once 5 or more failures have piled up —
 * the deadline (ms since epoch) until which the PIN form must stay disabled.
 */
export function recordFailedAttempt(
  previousAttempts: number,
  nowMs: number,
): { attempts: number; lockedUntilMs: number | null } {
  const attempts = Math.max(0, Math.floor(previousAttempts)) + 1;
  const seconds = lockoutSecondsFor(attempts);
  return {
    attempts,
    lockedUntilMs: seconds === null ? null : nowMs + seconds * 1000,
  };
}
