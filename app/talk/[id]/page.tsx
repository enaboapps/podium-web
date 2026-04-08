'use client';

import { OfflineGate } from '@/components/offline/OfflineGate';
import OfflineTalkPage from './OfflineTalkPage';
import OnlineTalkPage from './OnlineTalkPage';

export default function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <OfflineGate
      emergency={<OfflineTalkPage params={params} />}
      unavailableTitle="Offline talk unavailable"
      unavailableMessage="Connect once and open your library online before Podium can present talks offline."
    >
      <OnlineTalkPage params={params} />
    </OfflineGate>
  );
}
