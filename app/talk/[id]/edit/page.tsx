'use client';

import { use, useState, useEffect, useMemo, useCallback, useRef, MouseEvent } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { OfflineGate } from '@/components/offline/OfflineGate';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { splitIntoSentences, joinFullText } from '@/lib/parseFile';
import { invalidateTalkOfflineState } from '@/lib/offlineTalkMaintenance';
import { getSegmentWords, hasDelivery } from '@/lib/delivery';
import { getTTSConfig } from '@/lib/tts';
import { SegmentDeliveryEditor, SegmentDeliveryEditorHandle, SegmentDeliveryValue } from '@/components/segments/SegmentDeliveryEditor';
import { UnsavedChangesBar } from '@/components/UnsavedChangesBar';
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

      {/* Mode + segment count */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)] shrink-0">
        <span className="text-xs text-[var(--muted)]">Split by</span>
        {(['paragraphs', 'sentences'] as SegmentMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setSaved(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              mode === m ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface)] text-[var(--muted)]'
            }`}
          >
            {m}
          </button>
        ))}
        <span className="ml-auto text-xs text-[var(--muted)]">{previewSegments.length} segments</span>
      </div>

      {/* Full text editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <textarea
          value={fullText}
          onChange={(e) => { setFullText(e.target.value); setSaved(false); }}
          className="flex-1 w-full bg-transparent px-5 py-4 text-base text-[var(--foreground)] resize-none outline-none leading-relaxed"
          placeholder="Your speech text…"
          spellCheck
        />
      </div>

      {/* Segment preview strip */}
      <div className="border-t border-[var(--border)] shrink-0">
        <div className="px-5 py-2 flex items-center justify-between">
          <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide">Preview</span>
          <span className="text-xs text-[var(--muted)]">
            {dirty ? 'Save to edit segments. Unchanged segments keep their styling.' : 'Tap a segment to set its mood, pauses and more'}
          </span>
        </div>
        <div className="overflow-x-auto flex gap-2 px-5 pb-4">
          {/* Saved: show the stored segments, so each card opens exactly that segment.
              Unsaved: show how the text will split, dimmed until it's saved. */}
          {(dirty ? previewSegments : (talk?.segments ?? []).map((s) => s.text)).map((text, i) => {
            const storedSegment = dirty ? undefined : talk?.segments[i];
            const hasElements = !!storedSegment && hasDelivery(storedSegment);
            return (
              <button
                key={storedSegment?.id ?? i}
                type="button"
                disabled={!storedSegment}
                onClick={() => { if (storedSegment) setBrickSegmentId(storedSegment.id); }}
                className="relative shrink-0 w-52 bg-[var(--surface)] rounded-xl px-3 py-2 border border-[var(--border)] text-left active:opacity-70 disabled:opacity-50 disabled:active:opacity-50"
              >
                {hasElements && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                )}
                <p className="text-xs text-[var(--muted)] mb-1">{i + 1}</p>
                <p className="text-xs text-[var(--foreground)] leading-relaxed line-clamp-4">{text}</p>
              </button>
            );
          })}
        </div>
      </div>
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
