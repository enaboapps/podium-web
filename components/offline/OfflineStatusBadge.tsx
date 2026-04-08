'use client';

import type { CachedTalkStatus } from '@/lib/offlineStore';

interface OfflineStatusBadgeProps {
  status?: CachedTalkStatus;
  documentAvailable?: boolean;
}

export function OfflineStatusBadge({ status, documentAvailable = false }: OfflineStatusBadgeProps) {
  if (!status?.hasDocument && !documentAvailable) {
    return (
      <span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
        Not prepared
      </span>
    );
  }

  if (!status?.hasAudio) {
    return (
      <span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
        Document only
      </span>
    );
  }

  return (
    <span className="rounded-full bg-[var(--primary)] px-2 py-1 text-xs text-white">
      Ready offline
    </span>
  );
}
