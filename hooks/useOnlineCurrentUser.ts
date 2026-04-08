'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function useOnlineCurrentUser() {
  const { user, isLoaded } = useUser();
  const syncUser = useMutation(api.users.sync);

  useEffect(() => {
    if (!isLoaded || !user) return;

    syncUser({
      clerkId: user.id,
      name: user.fullName ?? user.username ?? 'Unknown',
      email: user.primaryEmailAddress?.emailAddress ?? '',
    });
  }, [isLoaded, syncUser, user]);

  return { user, isLoaded, clerkId: user?.id };
}
