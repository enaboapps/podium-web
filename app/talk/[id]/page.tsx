'use client';

import { OfflineGate } from '@/components/offline/OfflineGate';
import TalkPresentationPage from './TalkPresentationPage';

export default function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <OfflineGate
      alwaysMountChildren
      unavailableTitle="Offline talk unavailable"
      unavailableMessage="Connect once and open your library online before Podium can present talks offline."
    >
      <TalkPresentationPage params={params} />
    </OfflineGate>
  );
}
