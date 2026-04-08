'use client';

export function OfflineBooting() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Opening Podium</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Checking your last synced content and app runtime.
        </p>
      </div>
    </div>
  );
}
