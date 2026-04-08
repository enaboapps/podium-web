'use client';

import { useEffect, useMemo } from 'react';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { OfflineBooting } from '@/components/offline/OfflineBooting';
import { OfflineBootProvider, useOfflineBoot } from '@/hooks/useOfflineBoot';

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
    return new ConvexReactClient(url);
  }, []);

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

function OnlineRuntimeReady({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  const { markOnlineRuntimeReady } = useOfflineBoot();

  useEffect(() => {
    if (!isLoaded) return;
    markOnlineRuntimeReady();
  }, [isLoaded, markOnlineRuntimeReady]);

  return <>{children}</>;
}

function AppRuntimeBoundary({ children }: { children: React.ReactNode }) {
  const { mode } = useOfflineBoot();

  if (mode === 'booting') {
    return <OfflineBooting />;
  }

  return <>{children}</>;
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <OfflineBootProvider>
        <ConvexClerkProvider>
          <OnlineRuntimeReady>
            <AppRuntimeBoundary>
              <main className="min-h-dvh">
                {children}
              </main>
            </AppRuntimeBoundary>
          </OnlineRuntimeReady>
        </ConvexClerkProvider>
      </OfflineBootProvider>
    </ClerkProvider>
  );
}
