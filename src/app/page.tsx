import { PageShell } from "@/components/page-shell";

export default function Home() {
  return (
    <PageShell>
      <section
        aria-labelledby="home-heading"
        className="flex w-full flex-col items-center text-center"
      >
        <h1
          id="home-heading"
          className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50"
        >
          SOS Signal
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          A simple way to request a ride.
        </p>
        <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          This page is private. Ask your friend for an access link.
        </p>
      </section>
    </PageShell>
  );
}
