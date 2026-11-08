import { constantTimeHashEquals } from "./secure-compare";

/**
 * Check whether the URL's [secret] segment matches SOS_LINK_SECRET.
 *
 * The link secret doubles as the page address, so a mismatch must yield a
 * normal 404 with no distinguishing information. The comparison is
 * constant-time so probing cannot shortcut it.
 */
export function isLinkSecretMatch(
  candidate: string | undefined,
  linkSecret: string,
): boolean {
  if (typeof candidate !== "string" || candidate === "") {
    return false;
  }
  return constantTimeHashEquals(candidate, linkSecret);
}
