'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getOfflineBootstrap,
  rebuildOfflineBootstrapFromCachedTalks,
  refreshOfflineBootstrap,
  type OfflineBootstrapRecord,
} from '@/lib/offlineStore';

const ONLINE_BOOT_TIMEOUT_MS = 2000;

export type OfflineBootMode =
  | 'booting'
  | 'online'
  | 'offline-emergency'
  | 'offline-unavailable';

interface OfflineBootContextValue {
  mode: OfflineBootMode;
  isOnline: boolean;
  lastUserId: string | null;
  lastSyncedAt: number | null;
  library: OfflineBootstrapRecord | null;
  syncState: 'ready' | 'partial' | null;
  markOnlineRuntimeReady: () => void;
  refreshOfflineBootstrap: () => Promise<OfflineBootstrapRecord | null>;
}

const OfflineBootContext = createContext<OfflineBootContextValue | null>(null);

export function OfflineBootProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<OfflineBootMode>('booting');
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));
  const [library, setLibrary] = useState<OfflineBootstrapRecord | null>(null);
  const onlineReadyRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBootTimeout = useCallback(() => {
    if (!timeoutRef.current) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const loadBootstrap = useCallback(async () => {
    const bootstrap = await getOfflineBootstrap();
    if (bootstrap) {
      setLibrary(bootstrap);
      return bootstrap;
    }

    const rebuilt = await rebuildOfflineBootstrapFromCachedTalks();
    setLibrary(rebuilt ?? null);
    return rebuilt ?? null;
  }, []);

  const refreshBootstrap = useCallback(async () => {
    const bootstrap = await refreshOfflineBootstrap();
    if (bootstrap) {
      setLibrary(bootstrap);
      return bootstrap;
    }

    const rebuilt = await rebuildOfflineBootstrapFromCachedTalks();
    setLibrary(rebuilt ?? null);
    return rebuilt ?? null;
  }, []);

  const resolveMode = useCallback(async (nextOnline: boolean) => {
    clearBootTimeout();
    const bootstrap = await loadBootstrap();

    if (!nextOnline) {
      onlineReadyRef.current = false;
      setMode(bootstrap ? 'offline-emergency' : 'offline-unavailable');
      return;
    }

    setMode('booting');

    if (onlineReadyRef.current) {
      setMode('online');
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setMode(bootstrap ? 'offline-emergency' : 'offline-unavailable');
    }, ONLINE_BOOT_TIMEOUT_MS);
  }, [clearBootTimeout, loadBootstrap]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void resolveMode(isOnline);
    }, 0);

    return () => {
      clearTimeout(timer);
      clearBootTimeout();
    };
  }, [clearBootTimeout, isOnline, resolveMode]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const markOnlineRuntimeReady = useCallback(() => {
    onlineReadyRef.current = true;
    clearBootTimeout();
    setMode('online');
    void refreshBootstrap();
  }, [clearBootTimeout, refreshBootstrap]);

  const value = useMemo<OfflineBootContextValue>(() => ({
    mode,
    isOnline,
    lastUserId: library?.userId ?? null,
    lastSyncedAt: library?.lastSyncedAt ?? null,
    library,
    syncState: library?.syncState ?? null,
    markOnlineRuntimeReady,
    refreshOfflineBootstrap: refreshBootstrap,
  }), [isOnline, library, markOnlineRuntimeReady, mode, refreshBootstrap]);

  return (
    <OfflineBootContext.Provider value={value}>
      {children}
    </OfflineBootContext.Provider>
  );
}

export function useOfflineBoot() {
  const context = useContext(OfflineBootContext);
  if (!context) {
    throw new Error('useOfflineBoot must be used within OfflineBootProvider');
  }
  return context;
}
