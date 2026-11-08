"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shared client-side countdown helpers used by the PIN lockout and the SOS
 * cooldown. Both are convenience UX, driven by a millisecond deadline.
 */

/** 95 -> "1:35" */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Tick once per half-second while `endsAtMs` is in the future and return the
 * remaining seconds (0 after expiry). `onExpire` fires exactly once per
 * deadline. All time reads happen inside timer callbacks, never during
 * render, and the first tick runs in a task so no state is set synchronously
 * inside the effect.
 */
export function useCountdown(
  endsAtMs: number | null,
  onExpire?: () => void,
): number {
  const [remaining, setRemaining] = useState(0);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (endsAtMs === null) {
      return;
    }

    let expired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !expired) {
        expired = true;
        onExpireRef.current?.();
      }
    };

    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [endsAtMs]);

  return remaining;
}
