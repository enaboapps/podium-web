'use client';

import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import OfflineTalkPage from './OfflineTalkPage';
import OnlineTalkPage from './OnlineTalkPage';

export default function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { mode } = useOfflineBoot();

  if (mode === 'offline-emergency') {
    return <OfflineTalkPage params={params} />;
  }

  if (mode === 'offline-unavailable') {
    return (
      <OfflineUnavailable
        title="Offline talk unavailable"
        message="Connect once and open your library online before Podium can present talks offline."
      />
    );
  }

  return <OnlineTalkPage params={params} />;
}
