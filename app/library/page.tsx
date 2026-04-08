'use client';

import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import OnlineLibraryPage from './OnlineLibraryPage';
import OfflineLibraryPage from './OfflineLibraryPage';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';

export default function LibraryPage() {
  const { mode } = useOfflineBoot();

  if (mode === 'offline-emergency') {
    return <OfflineLibraryPage />;
  }

  if (mode === 'offline-unavailable') {
    return (
      <OfflineUnavailable
        title="Offline library unavailable"
        message="Connect once and open your library online before Podium can show your talks offline."
      />
    );
  }

  return <OnlineLibraryPage />;
}
