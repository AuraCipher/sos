"use client";

import {
  getDeadlineStore,
  getNumberStore,
  useDeadlineStore,
} from "./browser-storage";
import {
  PIN_ATTEMPTS_STORAGE_KEY,
  PIN_LOCKED_UNTIL_STORAGE_KEY,
  recordFailedAttempt,
} from "./lockout";

const attemptsStore = getNumberStore(PIN_ATTEMPTS_STORAGE_KEY);
const lockStore = getDeadlineStore(PIN_LOCKED_UNTIL_STORAGE_KEY);

/**
 * Browser-side PIN lockout wiring. The progressive-lockout table itself is
 * pure logic in lockout.ts; this module persists it and exposes reactive
 * hooks. Reminder: this is a friendly stagger, not a security boundary —
 * clearing browser storage or using another browser resets it, and the
 * server verifies every PIN independently.
 */

/** The moment the lockout lifts (ms since epoch), or null when unlocked. */
export function usePinLockDeadline(): number | null {
  return useDeadlineStore(PIN_LOCKED_UNTIL_STORAGE_KEY);
}

/**
 * Record one wrong PIN attempt in the counter and arm the lockout once 5+
 * failures have stacked up. Runs only from event handlers.
 */
export function commitFailedPinAttempt(): {
  attempts: number;
  lockedForSeconds: number | null;
} {
  const now = Date.now();
  const result = recordFailedAttempt(attemptsStore.get() ?? 0, now);
  attemptsStore.set(result.attempts);

  let lockedForSeconds: number | null = null;
  if (result.lockedUntilMs !== null) {
    lockedForSeconds = Math.max(0, Math.round((result.lockedUntilMs - now) / 1000));
    lockStore.extendBy(lockedForSeconds);
  }

  return { attempts: result.attempts, lockedForSeconds };
}

/** Reset both the counter and the lock. Called after successful sign-in. */
export function clearPinAttemptState(): void {
  attemptsStore.remove();
  lockStore.clear();
}

/** Remove only the lock deadline; the counter survives a finished lockout. */
export function clearPinLockout(): void {
  lockStore.clear();
}
