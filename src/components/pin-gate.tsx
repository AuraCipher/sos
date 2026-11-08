"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
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

const PIN_LENGTH = 6;

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
 * PIN entry screen with a six-digit OTP-style interface (spec sections 3 + 4).
 *
 * Accessibility & interaction model:
 * - ONE real <input> powers the field (a single logical value, a single
 *   screen-reader node, and proper autocomplete="one-time-code" support);
 *   the six digit boxes are purely visual and marked aria-hidden.
 * - The input sits transparently on top of the boxes, so clicking anywhere
 *   focuses it naturally. typing, caret movement, Backspace (deletes the
 *   previous digit) and pasting a complete PIN all use native input
 *   behavior; onChange strips anything that is not a digit and caps at six.
 * - Only digits are accepted; inputMode="numeric" opens the numeric keypad.
 * - The field auto-submits (via form.requestSubmit(), the exact same code
 *   path as the UNLOCK button) once six digits are present. A just-tried
 *   entry is not retried automatically: edit a digit or press UNLOCK to
 *   retry it. The button also stays for partial entries.
 * - NOTE: OTP styling is a typing convenience. It does NOT stop password
 *   managers or browsers from remembering the PIN; the real protection is
 *   the server-side check, the progressive browser lockout (below) and the
 *   server-side throttle.
 *
 * The PIN is only ever sent over the wire to POST /api/auth/pin — it is
 * never stored by the browser. Failed attempts drive a progressive
 * browser-side lockout persisted through an external localStorage store, so
 * the countdown survives refreshes; it is deliberately a convenience guard,
 * not a security boundary.
 */
export function PinGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<PinStatus>("idle");
  const [statusMessage, setStatusMessage] = useState(IDLE_STATUS_TEXT);

  const formRef = useRef<HTMLFormElement>(null);
  const lastAutoSubmittedPinRef = useRef<string | null>(null);

  const lockEndsAt = usePinLockDeadline();

  const remaining = useCountdown(lockEndsAt, () => {
    clearPinLockout();
    setStatus("idle");
    setStatusMessage("Lockout ended. Enter your PIN again.");
  });

  const locked = lockEndsAt !== null;
  const disabled = status === "submitting" || locked;

  // Keep only numeric digits, at most six.
  function handlePinChange(raw: string) {
    setPin(raw.replace(/\D/g, "").slice(0, PIN_LENGTH));
  }

  // Auto-submit exactly like pressing UNLOCK, once the sixth digit lands.
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || locked || status === "submitting") {
      return;
    }
    // Do not loop on a value the server just rejected: it must change
    // (or the user presses UNLOCK) before another automatic try.
    if (lastAutoSubmittedPinRef.current === pin) {
      return;
    }
    lastAutoSubmittedPinRef.current = pin;
    formRef.current?.requestSubmit();
  }, [pin, locked, status]);

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

  // Full entries, partials, everything: plain input editing semantics.
  // (Backspace natively deletes the previous digit and shifts the caret.)
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && pin.length === 0) {
      // Nothing before the first digit — swallow to avoid form weirdness.
      event.preventDefault();
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

  const activeIndex = Math.min(pin.length, PIN_LENGTH - 1);

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
        ref={formRef}
        onSubmit={handleSubmit}
        className="mt-10 flex w-full flex-col gap-4 sm:max-w-sm"
      >
        <div
          className={`relative rounded-2xl focus-within:ring-4 focus-within:ring-zinc-600/10 ${
            disabled ? "opacity-60" : ""
          }`}
        >
          <label htmlFor="sos-pin" className="sr-only">
            Your six-digit PIN
          </label>
          <div
            aria-hidden="true"
            className="grid grid-cols-6 gap-2 sm:gap-3"
          >
            {Array.from({ length: PIN_LENGTH }, (_, index) => {
              const digit = pin[index] ?? "";
              const isActive = index === activeIndex;
              return (
                <div
                  key={index}
                  className={`flex h-14 w-full items-center justify-center rounded-2xl border bg-white text-2xl font-bold sm:text-3xl dark:bg-zinc-900 ${
                    digit !== ""
                      ? "border-zinc-600 text-zinc-900 dark:border-zinc-400 dark:text-zinc-100"
                      : isActive
                        ? "border-zinc-500 dark:border-zinc-500"
                        : "border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {digit !== "" ? (
                    digit
                  ) : isActive && !disabled ? (
                    <span className="h-7 w-0.5 rounded-full bg-zinc-500 sm:h-8 dark:bg-zinc-400" />
                  ) : null}
                </div>
              );
            })}
          </div>
          <input
            id="sos-pin"
            type="text"
            value={pin}
            onChange={(event) => handlePinChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="000000"
            maxLength={PIN_LENGTH}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={disabled}
            aria-describedby="pin-status"
            className="absolute inset-0 h-full w-full cursor-text rounded-2xl text-2xl opacity-0 outline-none disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled={disabled}
          className={`flex h-14 w-full items-center justify-center rounded-2xl px-6 text-lg font-extrabold tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-600/20 ${buttonStyles}`}
        >
          {buttonLabel}
        </button>

        <p
          id="pin-status"
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
