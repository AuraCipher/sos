import { describe, expect, it } from "vitest";
import { lockoutSecondsFor, recordFailedAttempt } from "@/lib/lockout";

describe("progressive PIN lockout table", () => {
  it("never locks the first four attempts", () => {
    for (let attempts = 1; attempts <= 4; attempts += 1) {
      expect(lockoutSecondsFor(attempts)).toBeNull();
    }
  });

  it("scales the lockout from the 5th failed attempt", () => {
    expect(lockoutSecondsFor(5)).toBe(30); // 30 seconds
    expect(lockoutSecondsFor(6)).toBe(60); // 1 minute
    expect(lockoutSecondsFor(7)).toBe(300); // 5 minutes
    expect(lockoutSecondsFor(8)).toBe(900); // 15 minutes
  });

  it("locks 30 minutes from the 9th failed attempt on", () => {
    expect(lockoutSecondsFor(9)).toBe(1800);
    expect(lockoutSecondsFor(10)).toBe(1800);
    expect(lockoutSecondsFor(50)).toBe(1800);
  });
});

describe("recording failed attempts", () => {
  it("counts attempts without locking below failure 5", () => {
    const result = recordFailedAttempt(3, 1000);
    expect(result.attempts).toBe(4);
    expect(result.lockedUntilMs).toBeNull();
  });

  it("sets a lock deadline from failure 5", () => {
    const result = recordFailedAttempt(4, 10_000);
    expect(result.attempts).toBe(5);
    expect(result.lockedUntilMs).toBe(10_000 + 30 * 1000);
    expect(recordFailedAttempt(5, 10_000).lockedUntilMs).toBe(10_000 + 60 * 1000);
    expect(recordFailedAttempt(6, 10_000).lockedUntilMs).toBe(10_000 + 300 * 1000);
    expect(recordFailedAttempt(7, 10_000).lockedUntilMs).toBe(10_000 + 900 * 1000);
    expect(recordFailedAttempt(8, 10_000).lockedUntilMs).toBe(10_000 + 1800 * 1000);
  });

  it("treats nonsense inputs as zero attempts", () => {
    const result = recordFailedAttempt(-2, 1000);
    expect(result.attempts).toBe(1);
    expect(result.lockedUntilMs).toBeNull();
  });
});
