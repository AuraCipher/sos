"use client";

import { useState, type FormEvent } from "react";
import { formatCountdown, useCountdown } from "@/lib/countdown";
import {
  commitFailedPinAttempt,
  clearPinAttemptState,
  clearPinLockout,
  usePinLockDeadline,
} from "@/lib/lockout-browser";
import { SOS_PIN_ENDPOINT } from "@/lib/sos";

type PinStatus = "idle" | "submitting" | "error";

type PinApiResponse = { ok: true } | { ok: false; error?: string };

const IDLE_STATUS_TEXT = "Enter your PIN to open the SOS panel.";
const LOCKED_STATUS_TEXT =
  "Too many incorrect attempts. Wait for the lockout to end.";
const SIGNIN_NETWORK_ERROR_TEXT =
  "Cannot reach the sign-in service. Check the connection and try again.";
const SIGNIN_GENERIC_ERROR_TEXT = "Sign-in failed. Please try again.";

const STATUS_TEXT_STYLES: Record<PinStatus, string> = {
  idle: "text-zinc-500 dark:text-zinc-400",
  submitting: "text-zinc-600 dark:text-zinc-300",
  error: "text-red-700 dark:text-red-400",
};

const LOCKED_TEXT_STYLE = "text-amber-700 dark:text-amber-400";

/**
 * PIN entry screen (spec sections 3 + 4).
 *
 * The PIN is only ever sent over the wire to POST /api/auth/pin — it is
 * never stored by the browser. Failed attempts drive a progressive
 * browser-side lockout persisted through an external localStorage store, so
 * the countdown survives refreshes; it is deliberately a convenience guard,
 * not a security boundary.
 */
export function PinGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [status, setStatus] = useState<PinStatus>("idle");
  const [statusMessage, setStatusMessage] = useState(IDLE_STATUS_TEXT);

  const lockEndsAt = usePinLockDeadline();

  const remaining = useCountdown(lockEndsAt, () => {
    clearPinLockout();
    setStatus("idle");
    setStatusMessage("Lockout ended. Enter your PIN again.");
  });

  const locked = lockEndsAt !== null;
  const disabled = status === "submitting" || locked;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }
    if (pin.length === 0) {
      setStatus("error");
      setStatusMessage("Enter your PIN first.");
      return;
    }

    setStatus("submitting");
    setStatusMessage("Checking your PIN…");

    try {
      const response = await fetch(SOS_PIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await response.json().catch(() => null)) as
        | PinApiResponse
        | null;

      // Correct PIN: the server has already set the session cookie.
      if (response.ok && data !== null && data.ok) {
        // Reset the failed-attempt counter after successful authentication.
        clearPinAttemptState();
        setStatus("idle");
        setStatusMessage(IDLE_STATUS_TEXT);
        onAuthenticated();
        return;
      }

      // Wrong PIN: step the browser-side progressive lockout.
      if (response.status === 401) {
        const result = commitFailedPinAttempt();
        if (result.lockedForSeconds !== null) {
          setStatus("idle");
          setStatusMessage(
            `Locked for ${formatCountdown(result.lockedForSeconds)} after too many incorrect attempts.`,
          );
        } else {
          setStatus("error");
          const triesLeft = 5 - result.attempts;
          setStatusMessage(
            triesLeft === 1
              ? "Incorrect PIN. One try left before a temporary lockout."
              : `Incorrect PIN. ${triesLeft} tries left before a temporary lockout.`,
          );
        }
        return;
      }

      setStatus("error");
      setStatusMessage(
        data !== null && !data.ok && typeof data.error === "string"
          ? data.error
          : SIGNIN_GENERIC_ERROR_TEXT,
      );
    } catch {
      setStatus("error");
      setStatusMessage(SIGNIN_NETWORK_ERROR_TEXT);
    }
  }

  const buttonStyles = locked
    ? "cursor-not-allowed bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
    : status === "submitting"
      ? "cursor-wait bg-zinc-700 text-white opacity-80"
      : "bg-zinc-900 text-white shadow-sm hover:bg-zinc-700 active:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

  const buttonLabel = locked
    ? `LOCKED · ${formatCountdown(remaining)}`
    : status === "submitting"
      ? "CHECKING…"
      : "UNLOCK";

  return (
    <section
      aria-labelledby="pin-heading"
      className="flex w-full flex-col items-center"
    >
      <h1
        id="pin-heading"
        className="text-center text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50"
      >
        PIN Check
      </h1>
      <p className="mt-4 text-center text-lg text-zinc-600 dark:text-zinc-400">
        Confirm it is you before the SOS panel opens.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex w-full flex-col gap-4 sm:max-w-sm"
      >
        <div className="relative">
          <label htmlFor="sos-pin" className="sr-only">
            Your personal PIN
          </label>
          <input
            id="sos-pin"
            type={showPin ? "text" : "password"}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="Your PIN"
            maxLength={64}
            autoComplete="off"
            disabled={disabled}
            className="h-14 w-full rounded-2xl border border-zinc-300 bg-white pl-4 pr-20 text-lg text-zinc-900 outline-none focus:border-zinc-600 focus:ring-4 focus:ring-zinc-600/10 disabled:opacity-60 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={() => setShowPin((value) => !value)}
            aria-pressed={showPin}
            aria-label={showPin ? "Hide PIN" : "Show PIN"}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-600/20 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {showPin ? "Hide" : "Show"}
          </button>
        </div>

        <button
          type="submit"
          disabled={disabled}
          className={`flex h-14 w-full items-center justify-center rounded-2xl px-6 text-lg font-extrabold tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-600/20 ${buttonStyles}`}
        >
          {buttonLabel}
        </button>

        <p
          role="status"
          aria-live="polite"
          className={`min-h-6 text-center text-sm leading-6 ${
            locked ? LOCKED_TEXT_STYLE : STATUS_TEXT_STYLES[status]
          }`}
        >
          {locked ? LOCKED_STATUS_TEXT : statusMessage}
        </p>
      </form>
    </section>
  );
}
