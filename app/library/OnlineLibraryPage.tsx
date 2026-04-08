'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { AssignTalkSheet } from '@/components/library/AssignTalkSheet';
import { ImportTalkSheet } from '@/components/library/ImportTalkSheet';
import { LibraryFab } from '@/components/library/LibraryFab';
import { LibraryHeader } from '@/components/library/LibraryHeader';
import { LibraryTabs } from '@/components/library/LibraryTabs';
import { SetList } from '@/components/library/SetList';
import { TalkList } from '@/components/library/TalkList';
import {
  CreateMode,
  ImportDraft,
  LibraryTab,
  SegmentMode,
} from '@/components/library/libraryTypes';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import { useOfflineLibrarySync } from '@/hooks/useOfflineLibrarySync';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { parseFile, splitIntoSentences, joinFullText } from '@/lib/parseFile';
import { CachedTalkStatus, getTalkPreparedState } from '@/lib/offlineStore';
import OfflineLibraryPage from './OfflineLibraryPage';

export default function OnlineLibraryPage() {
  const { clerkId } = useOnlineCurrentUser();
  const { library, refreshOfflineBootstrap } = useOfflineBoot();
  const [tab, setTab] = useState<LibraryTab>('talks');
  const [createMode, setCreateMode] = useState<CreateMode>('none');
  const [newTalkTitle, setNewTalkTitle] = useState('');
  const [newSetTitle, setNewSetTitle] = useState('');
  const [fabOpen, setFabOpen] = useState(false);
  const [importDraft, setImportDraft] = useState<ImportDraft | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [assignTalkId, setAssignTalkId] = useState<string | null>(null);
  const [talkStatuses, setTalkStatuses] = useState<Record<string, CachedTalkStatus>>({});
  const [statusesReady, setStatusesReady] = useState(false);
  const [forceOfflineFallback, setForceOfflineFallback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const talks = useQuery(api.talks.list, clerkId ? { userId: clerkId } : 'skip');
  const sets = useQuery(api.talkSets.list, clerkId ? { userId: clerkId } : 'skip');

  const createTalk = useMutation(api.talks.create);
  const createTalkWithSegments = useMutation(api.talks.createWithSegments);
  const removeTalk = useMutation(api.talks.remove);
  const createSet = useMutation(api.talkSets.create);
  const removeSet = useMutation(api.talkSets.remove);
  const addTalkToSet = useMutation(api.talkSets.addTalk);
  const removeTalkFromSet = useMutation(api.talkSets.removeTalk);

  const previewSegments = useMemo(() => {
    if (!importDraft) return [];

    return importDraft.mode === 'sentences'
      ? splitIntoSentences(importDraft.paragraphs)
      : importDraft.paragraphs;
  }, [importDraft]);

  useEffect(() => {
    if (talks !== undefined && sets !== undefined) {
      setForceOfflineFallback(false);
      return;
    }

    if (!library) return;

    const timeout = setTimeout(() => {
      setForceOfflineFallback(true);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [library, sets, talks]);

  useEffect(() => {
    if (!clerkId || !talks) {
      setStatusesReady(false);
      return;
    }

    const userId = clerkId;
    const liveTalks = talks;
    let cancelled = false;
    setStatusesReady(false);

    async function loadStatuses() {
      const entries = await Promise.all(
        liveTalks.map(async (talk) => {
          const status = await getTalkPreparedState(userId, talk._id);
          return [talk._id, status ?? {
            talkId: talk._id,
            hasDocument: true,
            hasAudio: false,
            segmentCount: talk.segments.length,
            cachedAudioSegments: 0,
            lastPreparedAt: null,
          }] as const;
        })
      );

      if (cancelled) return;

      setTalkStatuses(Object.fromEntries(entries));
      setStatusesReady(true);
    }

    void loadStatuses();

    return () => {
      cancelled = true;
    };
  }, [clerkId, talks]);

  const { syncState, syncError } = useOfflineLibrarySync({
    userId: clerkId,
    talks: statusesReady ? talks : undefined,
    sets: statusesReady ? sets : undefined,
    talkStatuses,
    refreshOfflineBootstrap,
  });

  function closeFab() {
    setFabOpen(false);
  }

  function openNew() {
    closeFab();
    setCreateMode(tab === 'talks' ? 'new' : 'set');
  }

  function openImport() {
    closeFab();
    setImportError('');
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setImportError('');

    try {
      const paragraphs = await parseFile(file);
      if (paragraphs.length === 0) throw new Error('No text found in file.');

      setImportDraft({
        title: file.name.replace(/\.(docx|pdf)$/i, ''),
        fullText: joinFullText(paragraphs),
        paragraphs,
        mode: 'paragraphs',
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to read file.');
    }
  }

  async function handleConfirmImport() {
    if (!importDraft) return;
    if (!clerkId) {
      setImportError('Unable to save — please check your connection and try again.');
      return;
    }

    setImporting(true);
    setImportError('');
    try {
      const segments = previewSegments.map((text, index) => ({ id: String(index), text }));
      await createTalkWithSegments({
        userId: clerkId,
        title: importDraft.title.trim() || 'Untitled',
        segments,
        fullText: importDraft.fullText,
        segmentMode: importDraft.mode,
      });
      setImportDraft(null);
    } catch {
      setImportError('Failed to save talk. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  async function handleCreateTalk(event: React.FormEvent) {
    event.preventDefault();
    if (!clerkId || !newTalkTitle.trim()) return;

    await createTalk({ userId: clerkId, title: newTalkTitle.trim() });
    setNewTalkTitle('');
    setCreateMode('none');
  }

  async function handleCreateSet(event: React.FormEvent) {
    event.preventDefault();
    if (!clerkId || !newSetTitle.trim()) return;

    await createSet({ userId: clerkId, title: newSetTitle.trim() });
    setNewSetTitle('');
    setCreateMode('none');
  }

  function handleDeleteTalk(talkId: string) {
    if (!clerkId) return;

    void removeTalk({ id: talkId as Id<'talks'>, userId: clerkId });
    setConfirmDeleteId(null);
  }

  function handleDeleteSet(setId: string) {
    if (!clerkId) return;

    void removeSet({ id: setId as Id<'talkSets'>, userId: clerkId });
    setConfirmDeleteId(null);
  }

  function handleToggleSetMembership(setId: Id<'talkSets'>, inSet: boolean) {
    if (!clerkId || !assignTalkId) return;

    if (inSet) {
      void removeTalkFromSet({ id: setId, userId: clerkId, talkId: assignTalkId as Id<'talks'> });
      return;
    }

    void addTalkToSet({ id: setId, userId: clerkId, talkId: assignTalkId as Id<'talks'> });
  }

  const syncLabel =
    syncState === 'syncing'
      ? 'Syncing offline data...'
      : syncState === 'ready'
        ? 'Available offline'
        : syncState === 'error'
          ? 'Offline sync failed'
          : 'Preparing offline data...';

  const syncClassName =
    syncState === 'ready'
      ? 'text-emerald-400'
      : syncState === 'error'
        ? 'text-red-400'
        : 'text-[var(--muted)]';

  if (forceOfflineFallback && library) {
    return <OfflineLibraryPage />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <LibraryHeader
        syncClassName={syncClassName}
        syncError={syncError}
        syncLabel={syncLabel}
      />

      <LibraryTabs activeTab={tab} onTabChange={setTab} />

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-24">
        {tab === 'talks' ? (
          <TalkList
            confirmDeleteId={confirmDeleteId}
            createMode={createMode}
            importError=""
            newTalkTitle={newTalkTitle}
            setsAvailable={(sets?.length ?? 0) > 0}
            talkStatuses={talkStatuses}
            talks={talks}
            onAssignRequest={setAssignTalkId}
            onCancelCreate={() => setCreateMode('none')}
            onCreateTalk={handleCreateTalk}
            onDeleteCancel={() => setConfirmDeleteId(null)}
            onDeleteConfirm={handleDeleteTalk}
            onDeleteRequest={setConfirmDeleteId}
            onNewTalkTitleChange={setNewTalkTitle}
          />
        ) : (
          <SetList
            confirmDeleteId={confirmDeleteId}
            createMode={createMode}
            newSetTitle={newSetTitle}
            sets={sets}
            onCancelCreate={() => setCreateMode('none')}
            onCreateSet={handleCreateSet}
            onDeleteCancel={() => setConfirmDeleteId(null)}
            onDeleteConfirm={handleDeleteSet}
            onDeleteRequest={setConfirmDeleteId}
            onNewSetTitleChange={setNewSetTitle}
          />
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <LibraryFab
        fabOpen={fabOpen}
        tab={tab}
        onClose={closeFab}
        onOpenImport={openImport}
        onOpenNew={openNew}
        onToggle={() => setFabOpen((value) => !value)}
      />

      <ImportTalkSheet
        importDraft={importDraft}
        importing={importing}
        previewSegments={previewSegments}
        error={importError}
        onClose={() => { setImportDraft(null); setImportError(''); }}
        onConfirm={handleConfirmImport}
        onModeChange={(mode: SegmentMode) => {
          if (!importDraft) return;
          setImportDraft({ ...importDraft, mode });
        }}
        onTitleChange={(title) => {
          if (!importDraft) return;
          setImportDraft({ ...importDraft, title });
        }}
      />

      <AssignTalkSheet
        assignTalkId={assignTalkId}
        sets={sets}
        onClose={() => setAssignTalkId(null)}
        onToggleSet={handleToggleSetMembership}
      />
    </div>
  );
}
