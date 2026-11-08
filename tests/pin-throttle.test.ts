import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isPinThrottled,
  registerPinFailure,
  resetPinThrottle,
} from "@/lib/pin-throttle";

describe("in-memory PIN throttle", () => {
  beforeEach(() => {
    resetPinThrottle();
  });

  afterEach(() => {
    resetPinThrottle();
  });

  it("allows up to five failures inside the window", () => {
    for (let i = 1; i <= 5; i += 1) {
      registerPinFailure("203.0.113.9", 1000 + i);
      expect(isPinThrottled("203.0.113.9", 2000)).toBe(false);
    }
  });

  it("throttles from the sixth failure", () => {
    for (let i = 1; i <= 6; i += 1) {
      registerPinFailure("203.0.113.9", 1000 + i);
    }
    expect(isPinThrottled("203.0.113.9", 2000)).toBe(true);
  });

  it("recovers once the window has passed", () => {
    for (let i = 1; i <= 6; i += 1) {
      registerPinFailure("203.0.113.9", i);
    }
    expect(isPinThrottled("203.0.113.9", 11 * 60 * 1000)).toBe(false);
    registerPinFailure("203.0.113.9", 11 * 60 * 1000 + 1);
    expect(isPinThrottled("203.0.113.9", 11 * 60 * 1000 + 2)).toBe(false);
  });
});
