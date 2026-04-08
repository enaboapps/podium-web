'use client';

import { SignIn } from '@clerk/nextjs';
import { OfflineGate } from '@/components/offline/OfflineGate';

export default function SignInPage() {
  return (
    <OfflineGate
      unavailableTitle="Sign in requires a connection"
      unavailableMessage="Podium cannot sign in while offline. Reconnect to continue."
      href="/library"
      actionLabel="Back to library"
    >
      <div className="flex min-h-dvh items-center justify-center">
        <SignIn />
      </div>
    </OfflineGate>
  );
}
