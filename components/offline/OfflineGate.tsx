'use client';

import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';

interface OfflineGateProps {
  children: React.ReactNode;
  unavailableTitle: string;
  unavailableMessage: string;
  href?: string;
  actionLabel?: string;
  emergency?: React.ReactNode;
  /**
   * When true, always render `children` regardless of connectivity mode.
   * The wrapped page is expected to handle offline states internally
   * (banner, cached playback, internal fallback) instead of being swapped out.
   *
   * This preserves component state, refs, and in-flight resources across
   * online/offline transitions — critical for flows like an active presentation
   * where unmounting would lose the user's position.
   */
  alwaysMountChildren?: boolean;
}

export function OfflineGate({
  children,
  unavailableTitle,
  unavailableMessage,
  href,
  actionLabel,
  emergency,
  alwaysMountChildren,
}: OfflineGateProps) {
  const { mode } = useOfflineBoot();

  if (alwaysMountChildren) {
    return <>{children}</>;
  }

  if (mode === 'offline-emergency') {
    return emergency ?? (
      <OfflineUnavailable
        title={unavailableTitle}
        message={unavailableMessage}
        href={href}
        actionLabel={actionLabel}
      />
    );
  }

  if (mode === 'offline-unavailable') {
    return (
      <OfflineUnavailable
        title={unavailableTitle}
        message={unavailableMessage}
        href={href}
        actionLabel={actionLabel}
      />
    );
  }

  return <>{children}</>;
}
