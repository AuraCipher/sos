import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SosGate } from "@/components/sos-gate";
import { loadLinkSecret, serverEnv } from "@/lib/env";
import { isLinkSecretMatch } from "@/lib/link-secret";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/session";

/**
 * Server gate for the private SOS page.
 *
 * 1. Verifies the URL's [secret] segment against SOS_LINK_SECRET; any other
 *    value is an ordinary 404 with zero distinguishing output.
 * 2. Verifies the signed session cookie and hands the client component an
 *    initialAuthenticated flag, so returning visitors skip the PIN screen.
 *
 * Under Cache Components, params and cookies() are runtime data: this
 * component runs per request inside a Suspense boundary (the page provides
 * a static shell + fallback). The leading `await connection()` marks the
 * whole gate as request-bound, so the wall-clock read in session expiry
 * checking (`Date.now()`) stays out of prerender probes instead of raising
 * the "blocking prerender" error.
 */
export default async function PrivateSosGate({
  params,
}: {
  params: Promise<{ secret: string }>;
}) {
  // Request-bound marker (see comment above); nothing before the awaits of
  // dynamic data is prerendered.
  await connection();
  const { secret } = await params;

  const linkSecret = loadLinkSecret();
  if (!linkSecret.ok) {
    // Nothing is sent to the visitor: even a misconfigured deployment only
    // shows the regular 404.
    console.error(
      "SOS configuration problem: SOS_LINK_SECRET is not set. Private page is returning 404 for every path.",
    );
    notFound();
  }
  if (!isLinkSecretMatch(secret, linkSecret.secret)) {
    notFound();
  }

  const cookieStore = await cookies();
  const sessionSecret = serverEnv("SOS_SESSION_SECRET");
  const authenticated = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    sessionSecret,
  );

  return <SosGate initialAuthenticated={authenticated} />;
}
