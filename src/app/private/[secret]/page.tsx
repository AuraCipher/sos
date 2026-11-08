import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import PrivateSosGate from "@/components/private-sos-gate";

/**
 * The private SOS page lives behind a secret URL path segment.
 *
 * Under Cache Components the [secret] param is runtime data, so the page
 * renders a static shell at build time and streams the gate per request
 * inside <Suspense>.
 */
export default function PrivateSosPage({
  params,
}: PageProps<"/private/[secret]">) {
  return (
    <PageShell>
      <Suspense fallback={<GateFallback />}>
        <PrivateSosGate params={params} />
      </Suspense>
    </PageShell>
  );
}

function GateFallback() {
  return (
    <p
      aria-live="polite"
      className="min-h-24 text-center text-sm text-zinc-500 dark:text-zinc-400"
    >
      Checking access…
    </p>
  );
}
