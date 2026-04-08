'use client';

interface OfflineUnavailableProps {
  title: string;
  message: string;
  href?: string;
  actionLabel?: string;
}

export function OfflineUnavailable({
  title,
  message,
  href = '/library',
  actionLabel = 'Back to library',
}: OfflineUnavailableProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{message}</p>
        <a
          href={href}
          className="mt-6 inline-flex rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          {actionLabel}
        </a>
      </div>
    </div>
  );
}
