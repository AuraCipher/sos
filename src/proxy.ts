import { NextResponse, type NextRequest } from "next/server";

/**
 * Request-time gate for the private SOS path (Next.js 16 Proxy convention).
 *
 * Runs BEFORE the page renders, so an incorrect /private/<secret> segment
 * gets a real HTTP 404. (notFound() inside the streamed <Suspense> shell can
 * only keep the 200 status the shell already sent — see not-found.md; this
 * proxy is the documented way to serve a real status code.)
 *
 * Fails closed: while SOS_LINK_SECRET is unset, every /private/* path 404s.
 * The regex-style matcher keeps this proxy off the rest of the site so it
 * can never interfere with the PIN or SOS endpoints.
 *
 * The secret is read with process.env (server-side only, never in a browser
 * bundle) and both sides are hashed with SHA-256 before a fixed-length
 * byte-by-byte comparison, so probing is not made easier by timing.
 */

const privatePrefix = "/private/";

/** The single segment right after /private/, or null for bare/other paths. */
function secretSegmentFrom(pathname: string): string | "multi" | null {
  if (!pathname.startsWith(privatePrefix)) {
    return null;
  }
  let rest = pathname.slice(privatePrefix.length);
  if (rest === "") {
    return null;
  }
  // Tolerate a trailing slash on the valid path (/private/<secret>/).
  if (rest.endsWith("/")) {
    rest = rest.slice(0, -1);
  }
  // Deeper paths are handed to the router, which serves its normal 404 page
  // (with a real 404 status) regardless of the first segment's contents.
  const slash = rest.indexOf("/");
  if (slash === -1) {
    return rest;
  }
  return rest === "" ? null : "multi";
}

/** Decode %XX escapes; undecodable input falls back to the raw segment. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Fixed-size, digest-first comparison: no early exit on mismatch. */
function digestEquals(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function proxy(
  request: NextRequest,
): Promise<NextResponse | Response> {
  const segment = secretSegmentFrom(new URL(request.url).pathname);

  // Deeper paths (e.g. /private/<anything>/more) are covered by the router's
  // own static 404, so let Next handle them normally.
  if (segment === "multi") {
    return NextResponse.next();
  }

  const linkSecret = process.env.SOS_LINK_SECRET;
  if (segment === null || linkSecret === undefined || linkSecret.trim() === "") {
    // Bare body: probing /private/** is indistinguishable from any other
    // miss, and nothing configuration-related is revealed.
    return new Response("Not found\n", { status: 404 });
  }

  const [candidate, expected] = await Promise.all([
    sha256Hex(decodeSegment(segment)),
    sha256Hex(linkSecret),
  ]);
  if (!digestEquals(candidate, expected)) {
    return new Response("Not found\n", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/private/:path*",
};
