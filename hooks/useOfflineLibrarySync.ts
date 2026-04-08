'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Doc } from '@/convex/_generated/dataModel';
import { saveTalkDocuments, type CachedTalk } from '@/lib/audioStore';
import {
  pruneOfflineLibraryData,
  saveOfflineLibraryBundle,
  type CachedTalkStatus,
  type OfflineBootstrapRecord,
} from '@/lib/offlineStore';

type LibrarySyncState = 'idle' | 'syncing' | 'ready' | 'error';

interface UseOfflineLibrarySyncArgs {
  userId?: string;
  talks?: Doc<'talks'>[];
  sets?: Doc<'talkSets'>[];
  talkStatuses: Record<string, CachedTalkStatus>;
  refreshOfflineBootstrap: () => Promise<OfflineBootstrapRecord | null>;
}

interface UseOfflineLibrarySyncResult {
  syncState: LibrarySyncState;
  syncError: string | null;
  lastSyncedAt: number | null;
}

function toCachedTalk(talk: Doc<'talks'>): CachedTalk {
  return {
    _id: talk._id,
    title: talk.title,
    segments: talk.segments,
    updatedAt: Date.now(),
  };
}

export function useOfflineLibrarySync({
  userId,
  talks,
  sets,
  talkStatuses,
  refreshOfflineBootstrap,
}: UseOfflineLibrarySyncArgs): UseOfflineLibrarySyncResult {
  const [syncState, setSyncState] = useState<LibrarySyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const payload = useMemo(() => {
    if (!userId || !talks || !sets) return null;

    return {
      userId,
      talks,
      sets,
      talkStatuses,
    };
  }, [sets, talkStatuses, talks, userId]);

  const latestPayloadRef = useRef<typeof payload>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const rerunRef = useRef(false);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  const runSync = useCallback(async () => {
    const current = latestPayloadRef.current;
    if (!current) return;

    inFlightRef.current = true;
    rerunRef.current = false;
    setSyncState('syncing');
    setSyncError(null);

    try {
      await saveTalkDocuments(current.talks.map(toCachedTalk));
      await pruneOfflineLibraryData(current.userId, current.talks.map((talk) => talk._id));

      const record = await saveOfflineLibraryBundle({
        userId: current.userId,
        talks: current.talks.map((talk) => ({ _id: talk._id, title: talk.title })),
        sets: current.sets.map((set) => ({ _id: set._id, title: set.title, talkIds: set.talkIds })),
        talkStatusById: current.talkStatuses,
      });

      const refreshed = await refreshOfflineBootstrap();
      if (disposedRef.current) return;

      setLastSyncedAt(refreshed?.lastSyncedAt ?? record.lastSyncedAt);
      setSyncState('ready');
    } catch (error) {
      if (disposedRef.current) return;
      setSyncState('error');
      setSyncError(error instanceof Error ? error.message : 'Offline sync failed');
    } finally {
      inFlightRef.current = false;

      if (rerunRef.current && !disposedRef.current) {
        rerunRef.current = false;
        void runSync();
      }
    }
  }, [refreshOfflineBootstrap]);

  useEffect(() => {
    latestPayloadRef.current = payload;
    if (!payload) {
      setSyncState('idle');
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (inFlightRef.current) {
        rerunRef.current = true;
        return;
      }

      void runSync();
    }, 250);

    return () => {
      if (!timeoutRef.current) return;
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [payload, runSync]);

  return { syncState, syncError, lastSyncedAt };
}
