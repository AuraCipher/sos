import type { ReactNode } from "react";

/**
 * Shared page chrome: header, centered main content, footer. Used by the
 * public landing page and the private SOS page so both look identical.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600"
          />
          <div>
            <p className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              SOS Pickup
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              A simple way to request a ride.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
        {children}
      </main>

      <footer className="pb-6">
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          A private pickup-request page for two friends.
        </p>
      </footer>
    </div>
  );
}
