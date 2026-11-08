"use client";

import { getDeadlineStore, useDeadlineStore } from "./browser-storage";
import { SOS_COOLDOWN_SECONDS, SOS_COOLDOWN_STORAGE_KEY } from "./sos";

const cooldownStore = getDeadlineStore(SOS_COOLDOWN_STORAGE_KEY);

/**
 * Browser-side SOS cooldown wiring (spec section 6): 30 seconds after a
 * successfully published SOS, persisted so a page refresh keeps the
 * countdown. Convenience restriction only — a cleared storage or a different
 * browser bypasses it, and the server always re-checks authentication.
 */

/** The moment the cooldown ends (ms since epoch), or null when not running. */
export function useSosCooldown(): number | null {
  return useDeadlineStore(SOS_COOLDOWN_STORAGE_KEY);
}

/** Arm a fresh 30-second cooldown. Called right after a successful publish. */
export function extendSosCooldown(): void {
  cooldownStore.extendBy(SOS_COOLDOWN_SECONDS);
}

export function clearSosCooldown(): void {
  cooldownStore.clear();
}
