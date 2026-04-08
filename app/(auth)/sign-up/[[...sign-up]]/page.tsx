'use client';

import { SignUp } from '@clerk/nextjs';
import { OfflineGate } from '@/components/offline/OfflineGate';

export default function SignUpPage() {
  return (
    <OfflineGate
      unavailableTitle="Sign up requires a connection"
      unavailableMessage="Podium cannot create an account while offline. Reconnect to continue."
      href="/library"
      actionLabel="Back to library"
    >
      <div className="flex min-h-dvh items-center justify-center">
        <SignUp />
      </div>
    </OfflineGate>
  );
}
