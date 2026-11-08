/**
 * Best-effort, in-memory server-side throttle for failed PIN attempts.
 *
 * The real lockout table lives in the friend's browser (src/lib/lockout.ts).
 * This keeps a plain in-process Map of recent failures per IP so that plain
 * scripted hammering (browser storage cleared) cannot spray the PIN endpoint
 * indefinitely from a warm serverless instance. It is opportunistic: it does
 * NOT survive instance restarts and does NOT share state between instances,
 * so it must never be presented as a strong guarantee.
 *
 * No database, no Redis — memory only, proportional to a 2-person app.
 */

const MAX_FAILURES_PER_WINDOW = 6;
const WINDOW_MS = 10 * 60 * 1000;

const failures = new Map<string, number[]>();

function prune(entries: number[], nowMs: number): number[] {
  return entries.filter((timestamp) => nowMs - timestamp < WINDOW_MS);
}

export function registerPinFailure(key: string, nowMs: number): void {
  const pruned = prune(failures.get(key) ?? [], nowMs);
  pruned.push(nowMs);
  failures.set(key, pruned);
}

/** True when the key has accumulated too many failures inside the window. */
export function isPinThrottled(key: string, nowMs: number): boolean {
  return prune(failures.get(key) ?? [], nowMs).length >=
    MAX_FAILURES_PER_WINDOW;
}

/** Best-effort client key: left-most proxy IP, else 'unknown'. */
export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = forwarded.split(",")[0].trim();
    if (first !== "") {
      return first;
    }
  }
  return "unknown";
}

/** Test helper: clear all in-memory state. */
export function resetPinThrottle(): void {
  failures.clear();
}
