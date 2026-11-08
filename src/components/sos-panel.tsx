"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  MAX_MESSAGE_LENGTH,
  SOS_API_ENDPOINT,
  SOS_COOLDOWN_SECONDS,
  type SosResponse,
} from "@/lib/sos";

type Phase = "idle" | "sending" | "cooldown" | "error";

const IDLE_STATUS_TEXT = "No message needed — one press sends the SOS.";
const NETWORK_ERROR_TEXT =
  "Cannot reach the SOS service. Check the connection and try again.";
const GENERIC_ERROR_TEXT = "Something went wrong. Please try again.";

const STATUS_TEXT_STYLES: Record<Phase, string> = {
  idle: "text-zinc-500 dark:text-zinc-400",
  sending: "text-zinc-600 dark:text-zinc-300",
  cooldown: "text-emerald-700 dark:text-emerald-400",
  error: "text-red-700 dark:text-red-400",
};

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function SosPanel() {
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMessage, setStatusMessage] = useState(IDLE_STATUS_TEXT);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  const busy = phase === "sending" || phase === "cooldown";

  // Cooldown countdown: ticks until the user may send another SOS.
  useEffect(() => {
    if (cooldownEndsAt === null) {
      return;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setCooldownEndsAt(null);
        setPhase("idle");
        setStatusMessage(IDLE_STATUS_TEXT);
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [cooldownEndsAt]);

  function startCooldown(seconds: number, text: string) {
    setCooldownEndsAt(Date.now() + seconds * 1000);
    setPhase("cooldown");
    setStatusMessage(text);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }

    setPhase("sending");
    setStatusMessage("Sending your SOS…");

    try {
      const response = await fetch(SOS_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = (await response.json().catch(() => null)) as
        | SosResponse
        | null;

      // Successful send: the backend dictates the cooldown length.
      if (response.ok && data !== null && data.ok) {
        startCooldown(
          typeof data.cooldownSeconds === "number" && data.cooldownSeconds > 0
            ? data.cooldownSeconds
            : SOS_COOLDOWN_SECONDS,
          "Request sent. Wait the full cooldown before sending another.",
        );
        return;
      }

      // Rate-limited: adopt the server's remaining wait time.
      if (
        response.status === 429 &&
        data !== null &&
        !data.ok &&
        typeof data.retryAfterSeconds === "number"
      ) {
        startCooldown(data.retryAfterSeconds, data.error);
        return;
      }

      setPhase("error");
      setStatusMessage(data !== null && !data.ok ? data.error : GENERIC_ERROR_TEXT);
    } catch {
      setPhase("error");
      setStatusMessage(NETWORK_ERROR_TEXT);
    }
  }

  const buttonStyles =
    phase === "cooldown"
      ? "cursor-not-allowed bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      : phase === "sending"
        ? "cursor-wait bg-red-600 text-white opacity-80"
        : "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800";

  const buttonLabel =
    phase === "cooldown"
      ? `RESEND IN ${formatCountdown(remaining)}`
      : phase === "sending"
        ? "SENDING…"
        : "SEND SOS";

  return (
    <section
      aria-labelledby="sos-heading"
      className="flex w-full flex-col items-center"
    >
      <h1
        id="sos-heading"
        className="text-center text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50"
      >
        Need a Ride?
      </h1>
      <p className="mt-4 text-center text-lg text-zinc-600 dark:text-zinc-400">
        Send a pickup request to your friend.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex w-full flex-col gap-4 sm:max-w-sm"
      >
        <button
          type="submit"
          disabled={busy}
          className={`flex h-16 w-full items-center justify-center rounded-2xl px-6 text-2xl font-extrabold tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-600/25 ${buttonStyles}`}
        >
          {buttonLabel}
        </button>

        <div>
          <label htmlFor="sos-message" className="sr-only">
            Optional message for the pickup request
          </label>
          <textarea
            id="sos-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add a message (optional)..."
            rows={3}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={busy}
            className="w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus:border-red-600 focus:ring-4 focus:ring-red-600/15 disabled:opacity-60 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>

        <p
          role="status"
          aria-live="polite"
          className={`min-h-6 text-center text-sm leading-6 ${STATUS_TEXT_STYLES[phase]}`}
        >
          {statusMessage}
        </p>
      </form>
    </section>
  );
}
