'use client';

import { SignIn } from '@clerk/nextjs';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';

export default function SignInPage() {
  const { mode } = useOfflineBoot();

  if (mode === 'offline-emergency' || mode === 'offline-unavailable') {
    return (
      <OfflineUnavailable
        title="Sign in requires a connection"
        message="Podium cannot sign in while offline. Reconnect to continue."
        href="/library"
        actionLabel="Back to library"
      />
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <SignIn />
    </div>
  );
}
