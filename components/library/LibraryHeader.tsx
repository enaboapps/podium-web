'use client';

interface LibraryHeaderProps {
  syncClassName: string;
  syncError: string | null;
  syncLabel: string;
}

export function LibraryHeader({
  syncClassName,
  syncError,
  syncLabel,
}: LibraryHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-5 pb-4 pt-6">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Podium
        </h1>
        <p className={`mt-1 text-xs ${syncClassName}`} title={syncError ?? undefined}>
          {syncLabel}
        </p>
      </div>
      <a href="/settings" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        Settings
      </a>
    </header>
  );
}
