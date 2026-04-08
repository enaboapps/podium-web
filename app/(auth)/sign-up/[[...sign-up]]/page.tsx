'use client';

import { SignUp } from '@clerk/nextjs';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';

export default function SignUpPage() {
  const { mode } = useOfflineBoot();

  if (mode === 'offline-emergency' || mode === 'offline-unavailable') {
    return (
      <OfflineUnavailable
        title="Sign up requires a connection"
        message="Podium cannot create an account while offline. Reconnect to continue."
        href="/library"
        actionLabel="Back to library"
      />
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <SignUp />
    </div>
  );
}
