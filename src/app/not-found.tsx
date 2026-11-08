export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-600" />
      <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Page not found
      </h1>
      <p className="mt-4 max-w-sm text-lg text-zinc-600 dark:text-zinc-400">
        Double-check the link you were given.
      </p>
    </div>
  );
}
