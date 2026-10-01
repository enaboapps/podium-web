'use client';

import { use, useState, useEffect, useMemo, useCallback, useRef, MouseEvent } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { OfflineGate } from '@/components/offline/OfflineGate';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { splitIntoSentences, joinFullText } from '@/lib/parseFile';
import { invalidateTalkOfflineState } from '@/lib/offlineTalkMaintenance';
import { getSegmentWords } from '@/lib/delivery';
import { getTTSConfig } from '@/lib/tts';
import { SegmentDeliveryEditor, SegmentDeliveryEditorHandle, SegmentDeliveryValue } from '@/components/segments/SegmentDeliveryEditor';
import { UnsavedChangesBar } from '@/components/UnsavedChangesBar';
import { SegmentBlockList } from '@/components/segments/SegmentBlockList';
import { Doc } from '@/convex/_generated/dataModel';

type SegmentMode = 'paragraphs' | 'sentences';
type StoredSegment = Doc<'talks'>['segments'][number];

/**
 * Re-segment the talk text, keeping the id and delivery presets of any segment
 * whose text is unchanged. New segments get fresh ids so presets can never be
 * attached to the wrong segment by position.
 */
function buildSegmentsForSave(texts: string[], previous: StoredSegment[]): StoredSegment[] {
  const unused = [...previous];
  return texts.map((text) => {
    const matchIndex = unused.findIndex((segment) => segment.text === text);
    if (matchIndex === -1) return { id: crypto.randomUUID(), text };
    const [match] = unused.splice(matchIndex, 1);
    return match;
  });
}

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <OfflineGate
      unavailableTitle="Editing unavailable offline"
      unavailableMessage="Talk editing is not available in Podium's offline emergency mode."
    >
      <OnlineEditPage params={params} />
    </OfflineGate>
  );
}

function OnlineEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useOnlineCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const saveEditedText = useMutation(api.talks.saveEditedText);
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');
  const saveSegmentDeliveryMutation = useMutation(api.talks.saveSegmentDelivery);

  const [fullText, setFullText] = useState('');
  const [mode, setMode] = useState<SegmentMode>('paragraphs');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [brickSegmentId, setBrickSegmentId] = useState<string | null>(null);
  const [brickEditorDirty, setBrickEditorDirty] = useState(false);
  const [brickClosePending, setBrickClosePending] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const [view, setView] = useState<'segments' | 'text'>('segments');
  // The segment you came from (Edit on the play page) or last opened, highlighted in the list.
  const [highlightSegmentId, setHighlightSegmentId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLButtonElement>(null);
  const scrolledToHighlightRef = useRef(false);
  const discardingRef = useRef(false);
  const segmentEditorRef = useRef<SegmentDeliveryEditorHandle>(null);
  const [brickSaving, setBrickSaving] = useState(false);

  useEffect(() => {
    if (!talk) return;
    const text = talk.fullText ?? talk.segments.map((s) => s.text).join('\n\n');
    setFullText(text);
    if (talk.segmentMode) setMode(talk.segmentMode);
  }, [talk]);

  const paragraphs = useMemo(() => {
    return fullText
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 0);
  }, [fullText]);

  const previewSegments = useMemo(() => {
    return mode === 'sentences' ? splitIntoSentences(paragraphs) : paragraphs;
  }, [paragraphs, mode]);

  const ttsConfig = useMemo(() => getTTSConfig(settings), [settings]);

  // Unsaved means different from what's stored, so undoing an edit (or
  // re-tapping the current split mode) doesn't leave the page stuck unsaved.
  const savedText = talk ? talk.fullText ?? talk.segments.map((s) => s.text).join('\n\n') : '';
  const savedMode: SegmentMode = talk?.segmentMode ?? 'paragraphs';
  const dirty = !!talk && (fullText !== savedText || mode !== savedMode);

  const brickSegment = talk?.segments.find((s) => s.id === brickSegmentId) ?? null;
  const brickSegmentIndex = brickSegment ? talk!.segments.indexOf(brickSegment) : -1;

  useEffect(() => {
    setBrickEditorDirty(false);
    setBrickClosePending(false);
  }, [brickSegmentId]);

  useEffect(() => {
    setHighlightSegmentId(new URLSearchParams(window.location.search).get('segment'));
  }, []);

  // Bring the segment you came from into view once the list has rendered.
  useEffect(() => {
    if (scrolledToHighlightRef.current || !highlightRef.current) return;
    scrolledToHighlightRef.current = true;
    highlightRef.current.scrollIntoView({ block: 'center' });
  });

  const hasUnsavedChanges = dirty || brickEditorDirty;

  // Warn before a reload, tab close or external navigation drops unsaved work.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!discardingRef.current) event.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function guardLeave(event: MouseEvent<HTMLAnchorElement>) {
    if (!dirty) return;
    event.preventDefault();
    setLeaveTarget(event.currentTarget.getAttribute('href'));
  }

  function handleBrickClose() {
    if (brickEditorDirty) {
      setBrickClosePending(true);
    } else {
      setBrickSegmentId(null);
    }
  }

  function confirmBrickClose() {
    setBrickSegmentId(null);
  }

  async function saveBrickAndClose() {
    setBrickSaving(true);
    try {
      await segmentEditorRef.current?.save();
      setBrickSegmentId(null);
    } catch {
      // Stay in the editor so the unsaved presets aren't lost.
      setBrickClosePending(false);
    } finally {
      setBrickSaving(false);
    }
  }

  function leaveTo(href: string) {
    discardingRef.current = true;
    window.location.href = href;
  }

  async function saveAndLeave() {
    if (leaveTarget && (await handleSave())) leaveTo(leaveTarget);
  }

  const handleBrickSave = useCallback(
    async (segmentId: string, value: SegmentDeliveryValue) => {
      if (!clerkId || !talk) return;
      await saveSegmentDeliveryMutation({ id: id as Id<'talks'>, userId: clerkId, segmentId, ...value });
      await invalidateTalkOfflineState({
        userId: clerkId,
        talkId: id,
        title: talk.title ?? 'Untitled',
        segments: talk.segments.map((s) => {
          if (s.id !== segmentId) return s;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { elements, ...rest } = s;
          return { ...rest, ...value };
        }),
      });
    },
    [clerkId, id, saveSegmentDeliveryMutation, talk]
  );

  /** Save the talk text; resolves true on success. */
  async function handleSave(): Promise<boolean> {
    if (!clerkId || !dirty || !talk) return false;
    setSaving(true);
    setSaveError(false);
    try {
      const segments = buildSegmentsForSave(previewSegments, talk.segments);
      await saveEditedText({
        id: id as Id<'talks'>,
        userId: clerkId,
        fullText: joinFullText(paragraphs),
        segments,
        segmentMode: mode,
      });
      await invalidateTalkOfflineState({
        userId: clerkId,
        talkId: id,
        title: talk?.title ?? 'Untitled',
        segments,
      });
      setSaved(true);
      return true;
    } catch {
      setSaveError(true);
      setLeaveTarget(null);
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (talk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      {leaveTarget ? (
        <UnsavedChangesBar
          saving={saving}
          onKeepEditing={() => setLeaveTarget(null)}
          onSaveAndLeave={saveAndLeave}
          onDiscard={() => leaveTo(leaveTarget)}
        />
      ) : (
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)] shrink-0">
        <a
          href={`/talk/${id}`}
          onClick={guardLeave}
          className="text-sm text-[var(--muted)]"
        >
          ← Back
        </a>
        <span className="text-sm font-semibold truncate mx-4 flex-1 text-center">{talk?.title}</span>
        <div className="flex items-center gap-3">
          <a href={`/talk/${id}/history`} onClick={guardLeave} className="text-xs text-[var(--muted)]">History</a>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`text-sm font-semibold disabled:opacity-30 ${saveError ? 'text-red-400' : 'text-[var(--primary)]'}`}
          >
            {saving ? '…' : saveError ? 'Failed — retry' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </header>
      )}

      {/* Split mode + view toggle */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[var(--border)] shrink-0">
        <span className="text-xs text-[var(--muted)]">Split by</span>
        {(['paragraphs', 'sentences'] as SegmentMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setSaved(false); }}
            aria-pressed={mode === m}
            className={`min-h-9 px-3 rounded-lg text-xs font-medium capitalize transition-colors ${
              mode === m ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface)] text-[var(--muted)]'
            }`}
          >
            {m}
          </button>
        ))}
        <button
          onClick={() => setView(view === 'segments' ? 'text' : 'segments')}
          className="ml-auto min-h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--foreground)]"
        >
          {view === 'segments' ? 'Edit text' : 'Show segments'}
        </button>
      </div>

      {view === 'text' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <textarea
            value={fullText}
            onChange={(e) => { setFullText(e.target.value); setSaved(false); }}
            className="flex-1 w-full bg-transparent px-5 py-4 text-base text-[var(--foreground)] resize-none outline-none leading-relaxed"
            placeholder="Your speech text…"
            spellCheck
            autoFocus
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {dirty ? (
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] px-5 py-3">
              <p className="flex-1 text-sm text-[var(--foreground)]">
                {mode !== savedMode && fullText === savedText
                  ? `Save to split into ${mode}. Segments that don’t change keep their styling.`
                  : 'Save your text changes to style these segments.'}
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="min-h-11 shrink-0 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <p className="px-5 pt-4 text-xs text-[var(--muted)]">
              Tap a {mode === 'sentences' ? 'sentence' : 'paragraph'} to set its mood, pace and pauses.
            </p>
          )}

          <SegmentBlockList
            texts={dirty ? previewSegments : (talk?.segments ?? []).map((s) => s.text)}
            segments={dirty ? undefined : talk?.segments}
            highlightId={highlightSegmentId}
            highlightRef={highlightRef}
            onOpen={(segmentId) => {
              setHighlightSegmentId(segmentId);
              setBrickSegmentId(segmentId);
            }}
          />
        </div>
      )}
    </div>

    {brickSegment && (
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
        {brickClosePending ? (
          <UnsavedChangesBar
            saving={brickSaving}
            onKeepEditing={() => setBrickClosePending(false)}
            onSaveAndLeave={saveBrickAndClose}
            onDiscard={confirmBrickClose}
          />
        ) : (
          <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)] shrink-0">
            <button onClick={handleBrickClose} className="text-sm text-[var(--muted)]">← Back</button>
            <span className="text-sm font-semibold">Segment {brickSegmentIndex + 1}</span>
            <div className="w-16" />
          </header>
        )}
        <SegmentDeliveryEditor
          ref={segmentEditorRef}
          key={brickSegment.id}
          initialValue={{ words: getSegmentWords(brickSegment), mood: brickSegment.mood, pace: brickSegment.pace }}
          segmentId={brickSegment.id}
          segmentText={brickSegment.text}
          ttsConfig={ttsConfig}
          onDirtyChange={setBrickEditorDirty}
          onSave={handleBrickSave}
        />
      </div>
    )}
    </>
  );
}
