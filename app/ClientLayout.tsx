'use client';

import { useEffect, useMemo } from 'react';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { usePathname } from 'next/navigation';
import { OfflineBooting } from '@/components/offline/OfflineBooting';
import { OfflineBootProvider, useOfflineBoot } from '@/hooks/useOfflineBoot';

function isPublicRoute(pathname: string | null) {
  if (!pathname) return false;
  return pathname === '/' || pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
}

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
  const pathname = usePathname();

  if (!isPublicRoute(pathname) && mode === 'booting') {
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
