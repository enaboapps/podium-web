'use client';

import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Doc } from '@/convex/_generated/dataModel';
import { parseFile, splitIntoSentences, joinFullText } from '@/lib/parseFile';

const PREVIEW_CAP = 100;

type Tab = 'talks' | 'sets';
type CreateMode = 'none' | 'new' | 'set';
type SegmentMode = 'paragraphs' | 'sentences';

interface ImportDraft {
  title: string;
  fullText: string;
  paragraphs: string[];
  mode: SegmentMode;
}

export default function LibraryPage() {
  const { clerkId } = useCurrentUser();
  const [tab, setTab] = useState<Tab>('talks');
  const [createMode, setCreateMode] = useState<CreateMode>('none');
  const [newTalkTitle, setNewTalkTitle] = useState('');
  const [newSetTitle, setNewSetTitle] = useState('');
  const [fabOpen, setFabOpen] = useState(false);
  const [importDraft, setImportDraft] = useState<ImportDraft | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [assignTalkId, setAssignTalkId] = useState<string | null>(null);
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

  // Compute preview segments based on current draft mode
  const previewSegments = useMemo(() => {
    if (!importDraft) return [];
    return importDraft.mode === 'sentences'
      ? splitIntoSentences(importDraft.paragraphs)
      : importDraft.paragraphs;
  }, [importDraft]);

  function closeFab() { setFabOpen(false); }

  function openNew() {
    closeFab();
    setCreateMode(tab === 'talks' ? 'new' : 'set');
  }

  function openImport() {
    closeFab();
    setImportError('');
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

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
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to read file.');
    }
  }

  async function handleConfirmImport() {
    if (!clerkId || !importDraft) return;

    setImporting(true);
    try {
      const segments = previewSegments.map((text, i) => ({ id: String(i), text }));
      await createTalkWithSegments({
        userId: clerkId,
        title: importDraft.title.trim() || 'Untitled',
        segments,
        fullText: importDraft.fullText,
        segmentMode: importDraft.mode,
      });
      setImportDraft(null);
    } catch {
      setImportError('Failed to save talk.');
    } finally {
      setImporting(false);
    }
  }

  async function handleCreateTalk(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkId || !newTalkTitle.trim()) return;
    await createTalk({ userId: clerkId, title: newTalkTitle.trim() });
    setNewTalkTitle('');
    setCreateMode('none');
  }

  async function handleCreateSet(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkId || !newSetTitle.trim()) return;
    await createSet({ userId: clerkId, title: newSetTitle.trim() });
    setNewSetTitle('');
    setCreateMode('none');
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Podium</h1>
        <a href="/settings" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Settings
        </a>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {(['talks', 'sets'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
                : 'text-[var(--muted)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {tab === 'talks' && (
          <>
            {talks === undefined && <p className="text-center text-[var(--muted)] py-8">Loading...</p>}
            {talks?.length === 0 && createMode === 'none' && (
              <p className="text-center text-[var(--muted)] py-12 text-sm">No talks yet. Tap + to create your first.</p>
            )}
            {talks?.map((talk: Doc<'talks'>) => (
              <div key={talk._id} className="flex items-center justify-between bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-xl px-4 py-4 gap-3 transition-colors">
                <a href={`/talk/${talk._id}`} className="flex-1 font-medium text-[var(--foreground)] truncate">
                  {talk.title}
                </a>
                <div className="flex items-center gap-1 shrink-0">
                  {sets && sets.length > 0 && (
                    <button
                      onClick={() => setAssignTalkId(talk._id)}
                      className="text-[var(--muted)] hover:text-[var(--primary)] text-lg px-2 py-1 rounded transition-colors leading-none"
                      title="Add to set"
                    >
                      ⊕
                    </button>
                  )}
                  {confirmDeleteId === talk._id ? (
                    <>
                      <button
                        onClick={() => { clerkId && removeTalk({ id: talk._id as Id<'talks'>, userId: clerkId }); setConfirmDeleteId(null); }}
                        className="text-red-400 text-xs px-2 py-1 rounded transition-colors"
                      >
                        Confirm
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[var(--muted)] text-xs px-2 py-1 rounded transition-colors">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(talk._id)}
                      className="text-[var(--muted)] hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {createMode === 'new' && (
              <form onSubmit={handleCreateTalk} className="flex gap-2">
                <input
                  autoFocus
                  value={newTalkTitle}
                  onChange={(e) => setNewTalkTitle(e.target.value)}
                  placeholder="Talk title"
                  className="flex-1 bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none border border-[var(--border)] focus:border-[var(--primary)]"
                />
                <button type="submit" className="bg-[var(--primary)] text-white rounded-xl px-4 py-3 text-sm font-medium">Add</button>
                <button type="button" onClick={() => setCreateMode('none')} className="text-[var(--muted)] px-3 py-3 text-sm">Cancel</button>
              </form>
            )}
            {importError && <p className="text-center text-red-400 py-2 text-sm">{importError}</p>}
          </>
        )}

        {tab === 'sets' && (
          <>
            {sets === undefined && <p className="text-center text-[var(--muted)] py-8">Loading...</p>}
            {sets?.length === 0 && createMode === 'none' && (
              <p className="text-center text-[var(--muted)] py-12 text-sm">No sets yet. Group talks for an event.</p>
            )}
            {sets?.map((set: Doc<'talkSets'>) => (
              <div key={set._id} className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-xl px-4 py-4 transition-colors">
                <div className="flex items-center justify-between">
                  <a href={`/set/${set._id}`} className="flex-1 font-medium text-[var(--foreground)]">{set.title}</a>
                  {confirmDeleteId === set._id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { clerkId && removeSet({ id: set._id as Id<'talkSets'>, userId: clerkId }); setConfirmDeleteId(null); }}
                        className="text-red-400 text-xs px-2 py-1 rounded transition-colors"
                      >
                        Confirm
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[var(--muted)] text-xs px-2 py-1 rounded transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(set._id)}
                      className="text-[var(--muted)] hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {set.talkIds.length} {set.talkIds.length === 1 ? 'talk' : 'talks'}
                </p>
              </div>
            ))}
            {createMode === 'set' && (
              <form onSubmit={handleCreateSet} className="flex gap-2">
                <input
                  autoFocus
                  value={newSetTitle}
                  onChange={(e) => setNewSetTitle(e.target.value)}
                  placeholder="Set title (e.g. Conference 2026)"
                  className="flex-1 bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none border border-[var(--border)] focus:border-[var(--primary)]"
                />
                <button type="submit" className="bg-[var(--primary)] text-white rounded-xl px-4 py-3 text-sm font-medium">Add</button>
                <button type="button" onClick={() => setCreateMode('none')} className="text-[var(--muted)] px-3 py-3 text-sm">Cancel</button>
              </form>
            )}
          </>
        )}
      </main>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".docx,.pdf" className="hidden" onChange={handleFileChange} />

      {/* FAB overlay */}
      {fabOpen && <div className="fixed inset-0 z-10" onClick={closeFab} />}

      {/* FAB menu */}
      <div className="fixed bottom-6 right-5 z-20 flex flex-col items-end gap-3">
        {fabOpen && tab === 'talks' && (
          <>
            <button
              onClick={openImport}
              className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-2xl px-4 py-3 text-sm font-medium shadow-lg whitespace-nowrap"
            >
              Import file
              <span className="text-[var(--muted)] text-xs">.docx / .pdf</span>
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-2xl px-4 py-3 text-sm font-medium shadow-lg"
            >
              New talk
            </button>
          </>
        )}
        <button
          onClick={() => { if (tab === 'sets') openNew(); else setFabOpen((v) => !v); }}
          className={`w-14 h-14 rounded-full bg-[var(--primary)] text-white text-2xl flex items-center justify-center shadow-lg transition-transform ${fabOpen ? 'rotate-45' : ''} active:scale-95`}
        >
          +
        </button>
      </div>

      {/* Import preview sheet */}
      {importDraft && (
        <>
          <div className="fixed inset-0 z-30 bg-black/60" onClick={() => setImportDraft(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)] rounded-t-2xl max-h-[85dvh] flex flex-col">
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border)] shrink-0">
              <button onClick={() => setImportDraft(null)} className="text-[var(--muted)] text-sm">Cancel</button>
              <span className="text-sm font-semibold">Import talk</span>
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="text-[var(--primary)] text-sm font-semibold disabled:opacity-40"
              >
                {importing ? 'Saving…' : 'Import'}
              </button>
            </div>

            {/* Title field */}
            <div className="px-5 py-3 border-b border-[var(--border)] shrink-0">
              <input
                value={importDraft.title}
                onChange={(e) => setImportDraft({ ...importDraft, title: e.target.value })}
                className="w-full bg-transparent text-base font-medium text-[var(--foreground)] outline-none placeholder-[var(--muted)]"
                placeholder="Talk title"
              />
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-1 px-5 py-3 border-b border-[var(--border)] shrink-0">
              <span className="text-xs text-[var(--muted)] mr-2">Split by</span>
              {(['paragraphs', 'sentences'] as SegmentMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setImportDraft({ ...importDraft, mode: m })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                    importDraft.mode === m
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--surface)] text-[var(--muted)]'
                  }`}
                >
                  {m}
                </button>
              ))}
              <span className="ml-auto text-xs text-[var(--muted)]">{previewSegments.length} segments</span>
            </div>

            {/* Segment preview */}
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
              {previewSegments.slice(0, PREVIEW_CAP).map((text, i) => (
                <div key={i} className="bg-[var(--surface)] rounded-xl px-4 py-3">
                  <p className="text-sm text-[var(--foreground)] leading-relaxed">{text}</p>
                </div>
              ))}
              {previewSegments.length > PREVIEW_CAP && (
                <p className="text-center text-xs text-[var(--muted)] py-2">
                  Showing first {PREVIEW_CAP} of {previewSegments.length} segments
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Set assignment sheet */}
      {assignTalkId && sets && (
        <>
          <div className="fixed inset-0 z-30 bg-black/60" onClick={() => setAssignTalkId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)] rounded-t-2xl max-h-[60dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border)] shrink-0">
              <button onClick={() => setAssignTalkId(null)} className="text-[var(--muted)] text-sm">Done</button>
              <span className="text-sm font-semibold">Add to set</span>
              <div className="w-12" />
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {sets.map((set) => {
                const inSet = set.talkIds.includes(assignTalkId as Id<'talks'>);
                return (
                  <button
                    key={set._id}
                    onClick={() => {
                      if (!clerkId) return;
                      if (inSet) {
                        removeTalkFromSet({ id: set._id, userId: clerkId, talkId: assignTalkId as Id<'talks'> });
                      } else {
                        addTalkToSet({ id: set._id, userId: clerkId, talkId: assignTalkId as Id<'talks'> });
                      }
                    }}
                    className="w-full flex items-center justify-between bg-[var(--surface)] rounded-xl px-4 py-4 text-left"
                  >
                    <span className="font-medium text-[var(--foreground)]">{set.title}</span>
                    <span className={`text-lg ${inSet ? 'text-[var(--primary)]' : 'text-[var(--muted)]'}`}>
                      {inSet ? '✓' : '+'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
