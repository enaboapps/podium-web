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
}

export function OfflineGate({
  children,
  unavailableTitle,
  unavailableMessage,
  href,
  actionLabel,
  emergency,
}: OfflineGateProps) {
  const { mode } = useOfflineBoot();

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
