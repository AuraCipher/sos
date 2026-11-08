import { loadNtfyConfig } from "./env";
import { SOS_NOTIFICATION_TITLE } from "./sos";

/**
 * Publish the SOS notification through the ntfy HTTP API.
 *
 * All ntfy configuration (topic, server URL, token, priority) comes from
 * server-side environment variables (see src/lib/env.ts). The topic and
 * token never appear in URLs people see, in responses, or in this module's
 * logs — only ntfy itself needs them.
 *
 * The publish result is honest: ok:true is returned only after ntfy
 * confirmed the message with a successful response.
 */

export type PublishResult = { ok: true } | { ok: false; error: string };

export async function publishSosMessage(
  fullMessage: string,
): Promise<PublishResult> {
  const config = loadNtfyConfig();
  if (!config.ok) {
    return {
      ok: false,
      error:
        "The SOS service is not configured yet. Ask your friend to finish the setup.",
    };
  }

  const url = `${config.value.serverUrl}/${encodeURIComponent(config.value.topic)}`;
  const headers: Record<string, string> = {
    Title: SOS_NOTIFICATION_TITLE,
  };
  if (config.value.priority !== null) {
    headers.Priority = config.value.priority;
  }
  if (config.value.authToken !== null) {
    headers.Authorization = `Bearer ${config.value.authToken}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: fullMessage,
    });

    if (response.ok) {
      return { ok: true };
    }

    // Log only the status code — the response body could quote the topic.
    console.error(`ntfy publish failed with status ${response.status}.`);
    return {
      ok: false,
      error: "The notification service rejected the SOS. Please try again.",
    };
  } catch {
    return {
      ok: false,
      error: "Could not reach the notification service. Please try again.",
    };
  }
}
