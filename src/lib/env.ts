/**
 * Server-side configuration helpers.
 *
 * Rules enforced here:
 * - Secret values never leave the server: no logs, no HTML, no API responses.
 * - Missing or invalid configuration is reported by naming the env variable,
 *   never its value.
 * - Client components must never import this module. A guard test
 *   (tests/client-privacy.test.ts) enforces that these names stay out of
 *   browser-bound code.
 */

export type ServerConfigResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

/** Read a non-empty environment variable or null when unset/blank. */
export function serverEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  return value.trim();
}

const CONFIG_HINT =
  "Ask your friend to set it in the deployment environment (.env.local locally, project settings on Vercel).";

export type PinConfig = {
  pin: string;
  sessionSecret: string;
};

/** Configuration needed by the PIN authentication endpoint. */
export function loadPinConfig(): ServerConfigResult<PinConfig> {
  const pin = serverEnv("SOS_PIN");
  if (pin === null) {
    return {
      ok: false,
      message: `Server configuration is incomplete: SOS_PIN is not set. ${CONFIG_HINT}`,
    };
  }
  if (pin.length < 4) {
    return {
      ok: false,
      message:
        "Server configuration is invalid: SOS_PIN must be at least 4 characters long.",
    };
  }

  const sessionSecret = serverEnv("SOS_SESSION_SECRET");
  if (sessionSecret === null) {
    return {
      ok: false,
      message: `Server configuration is incomplete: SOS_SESSION_SECRET is not set. ${CONFIG_HINT}`,
    };
  }

  return { ok: true, value: { pin, sessionSecret } };
}

export type LinkSecretResult =
  | { ok: true; secret: string }
  | { ok: false; message: string };

/** Configuration needed by the private SOS page itself. */
export function loadLinkSecret(): LinkSecretResult {
  const secret = serverEnv("SOS_LINK_SECRET");
  if (secret === null) {
    return {
      ok: false,
      message: `Server configuration is incomplete: SOS_LINK_SECRET is not set. ${CONFIG_HINT}`,
    };
  }
  return { ok: true, secret };
}

export type NtfyConfig = {
  topic: string;
  serverUrl: string;
  authToken: string | null;
  priority: string | null;
};

const DEFAULT_NTFY_SERVER = "https://ntfy.sh";
const ALLOWED_PRIORITIES = new Set([
  "min",
  "low",
  "default",
  "high",
  "max",
  "urgent",
  "1",
  "2",
  "3",
  "4",
  "5",
]);

/** Configuration needed to publish notifications through ntfy. */
export function loadNtfyConfig(): ServerConfigResult<NtfyConfig> {
  const topic = serverEnv("NTFY_TOPIC");
  if (topic === null) {
    return {
      ok: false,
      message: `Server configuration is incomplete: NTFY_TOPIC is not set. ${CONFIG_HINT}`,
    };
  }

  let serverUrl = DEFAULT_NTFY_SERVER;
  const rawServer = serverEnv("NTFY_SERVER_URL");
  if (rawServer !== null) {
    try {
      const parsed = new URL(rawServer);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("unsupported protocol");
      }
      serverUrl = rawServer.replace(/\/+$/, "");
    } catch {
      return {
        ok: false,
        message:
          "Server configuration is invalid: NTFY_SERVER_URL must be a valid http(s) URL. Leave it empty to use https://ntfy.sh.",
      };
    }
  }

  let priority = serverEnv("NTFY_PRIORITY");
  if (priority !== null) {
    priority = priority.toLowerCase();
    if (!ALLOWED_PRIORITIES.has(priority)) {
      return {
        ok: false,
        message:
          "Server configuration is invalid: NTFY_PRIORITY must be a valid ntfy priority (min, low, default, high, max, urgent, or 1-5). Leave it empty for the ntfy default.",
      };
    }
  }

  return {
    ok: true,
    value: { topic, serverUrl, authToken: serverEnv("NTFY_AUTH_TOKEN"), priority },
  };
}
