import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison.
 *
 * Both values are hashed with SHA-256 first so the comparison buffers always
 * have identical length and the digest never exposes either input. Suitable
 * for comparing PINs, link secrets, and signed session values.
 */
export function constantTimeHashEquals(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}
