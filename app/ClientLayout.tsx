'use client';

import { useMemo } from 'react';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  const convex = useMemo(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://placeholder.convex.cloud'),
    []
  );

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexClerkProvider>
        <main className="min-h-dvh">
          {children}
        </main>
      </ConvexClerkProvider>
    </ClerkProvider>
  );
}
