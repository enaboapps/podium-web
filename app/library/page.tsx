'use client';

import { OfflineGate } from '@/components/offline/OfflineGate';
import OfflineLibraryPage from './OfflineLibraryPage';
import OnlineLibraryPage from './OnlineLibraryPage';

export default function LibraryPage() {
  return (
    <OfflineGate
      emergency={<OfflineLibraryPage />}
      unavailableTitle="Offline library unavailable"
      unavailableMessage="Connect once and open your library online before Podium can show your talks offline."
    >
      <OnlineLibraryPage />
    </OfflineGate>
  );
}
