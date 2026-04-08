'use client';

export function OfflineBanner({ lastSyncedAt }: { lastSyncedAt: number | null }) {
  const syncedLabel = lastSyncedAt
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastSyncedAt))
    : 'Unknown';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-sm font-medium text-[var(--foreground)]">Offline mode</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Showing last synced content from this device.
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Last sync: {syncedLabel}
      </p>
    </div>
  );
}
