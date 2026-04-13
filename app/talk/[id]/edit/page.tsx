'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { OfflineGate } from '@/components/offline/OfflineGate';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { splitIntoSentences, joinFullText } from '@/lib/parseFile';
import { invalidateTalkOfflineState } from '@/lib/offlineTalkMaintenance';
import { buildAnnotations, tokenise, SegmentElement } from '@/lib/ssml';
import { TTSConfig } from '@/lib/tts';
import { SegmentBrickEditor } from '@/components/segments/SegmentBrickEditor';

type SegmentMode = 'paragraphs' | 'sentences';

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
  const saveSegmentElementsMutation = useMutation(api.talks.saveSegmentElements);

  const [fullText, setFullText] = useState('');
  const [mode, setMode] = useState<SegmentMode>('paragraphs');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [brickSegmentId, setBrickSegmentId] = useState<string | null>(null);
  const [brickEditorDirty, setBrickEditorDirty] = useState(false);
  const [brickClosePending, setBrickClosePending] = useState(false);

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

  const isAzure = settings?.provider === 'azure';

  const ttsConfig: TTSConfig | null =
    settings && isAzure && settings.azureSubscriptionKey && settings.azureRegion
      ? { provider: 'azure', subscriptionKey: settings.azureSubscriptionKey,
          region: settings.azureRegion, voiceId: settings.azureVoiceId }
      : null;

  const brickSegment = talk?.segments.find((s) => s.id === brickSegmentId) ?? null;
  const brickSegmentIndex = brickSegment ? talk!.segments.indexOf(brickSegment) : -1;

  useEffect(() => {
    setBrickEditorDirty(false);
    setBrickClosePending(false);
  }, [brickSegmentId]);

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

  const handleBrickSave = useCallback(
    async (segmentId: string, elements: SegmentElement[]) => {
      if (!clerkId || !talk) return;
      await saveSegmentElementsMutation({ id: id as Id<'talks'>, userId: clerkId, segmentId, elements });
      await invalidateTalkOfflineState({
        userId: clerkId,
        talkId: id,
        title: talk.title ?? 'Untitled',
        segments: talk.segments.map((s) => s.id === segmentId ? { ...s, elements } : s),
      });
    },
    [clerkId, id, saveSegmentElementsMutation, talk]
  );

  async function handleSave() {
    if (!clerkId || !dirty) return;
    setSaving(true);
    setSaveError(false);
    try {
      const segments = previewSegments.map((text, i) => ({ id: String(i), text }));
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
      setDirty(false);
      setSaved(true);
    } catch {
      setSaveError(true);
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
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)] shrink-0">
        <a href={`/talk/${id}`} className="text-sm text-[var(--muted)]">← Back</a>
        <span className="text-sm font-semibold truncate mx-4 flex-1 text-center">{talk?.title}</span>
        <div className="flex items-center gap-3">
          <a href={`/talk/${id}/history`} className="text-xs text-[var(--muted)]">History</a>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`text-sm font-semibold disabled:opacity-30 ${saveError ? 'text-red-400' : 'text-[var(--primary)]'}`}
          >
            {saving ? '…' : saveError ? 'Failed — retry' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </header>

      {/* Mode + segment count */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)] shrink-0">
        <span className="text-xs text-[var(--muted)]">Split by</span>
        {(['paragraphs', 'sentences'] as SegmentMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setDirty(true); setSaved(false); }}
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
          onChange={(e) => { setFullText(e.target.value); setDirty(true); setSaved(false); }}
          className="flex-1 w-full bg-transparent px-5 py-4 text-base text-[var(--foreground)] resize-none outline-none leading-relaxed"
          placeholder="Your speech text…"
          spellCheck
        />
      </div>

      {/* Segment preview strip */}
      <div className="border-t border-[var(--border)] shrink-0">
        <div className="px-5 py-2 flex items-center justify-between">
          <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide">Preview</span>
        </div>
        <div className="overflow-x-auto flex gap-2 px-5 pb-4">
          {previewSegments.slice(0, 20).map((text, i) => {
            const storedSegment = talk?.segments[i];
            const hasElements = (storedSegment?.elements?.length ?? 0) > 0;
            const isClickable = !dirty && !!talk;
            return (
              <div
                key={i}
                onClick={() => { if (isClickable) setBrickSegmentId(storedSegment?.id ?? null); }}
                className={`relative shrink-0 w-52 bg-[var(--surface)] rounded-xl px-3 py-2 border border-[var(--border)] ${
                  isClickable ? 'cursor-pointer active:opacity-70' : 'cursor-default'
                }`}
              >
                {hasElements && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                )}
                <p className="text-xs text-[var(--muted)] mb-1">{i + 1}</p>
                <p className="text-xs text-[var(--foreground)] leading-relaxed line-clamp-4">{text}</p>
              </div>
            );
          })}
          {previewSegments.length > 20 && (
            <div className="shrink-0 w-24 bg-[var(--surface)] rounded-xl px-3 py-2 border border-[var(--border)] flex items-center justify-center">
              <p className="text-xs text-[var(--muted)]">+{previewSegments.length - 20} more</p>
            </div>
          )}
        </div>
      </div>
    </div>

    {brickSegment && (
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
        {brickClosePending ? (
          <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)] shrink-0">
            <button onClick={() => setBrickClosePending(false)} className="text-sm text-[var(--muted)]">Cancel</button>
            <span className="text-sm font-semibold text-[var(--foreground)]">Discard changes?</span>
            <button onClick={confirmBrickClose} className="text-sm font-semibold text-red-400">Discard</button>
          </header>
        ) : (
          <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)] shrink-0">
            <button onClick={handleBrickClose} className="text-sm text-[var(--muted)]">← Back</button>
            <span className="text-sm font-semibold">Segment {brickSegmentIndex + 1}</span>
            <div className="w-16" />
          </header>
        )}
        <SegmentBrickEditor
          key={brickSegment.id}
          initialAnnotations={
            (brickSegment.elements as SegmentElement[] | undefined)?.length
              ? buildAnnotations(brickSegment.elements as SegmentElement[])
              : tokenise(brickSegment.text)
          }
          segmentId={brickSegment.id}
          ttsConfig={ttsConfig}
          onDirtyChange={setBrickEditorDirty}
          onSave={handleBrickSave}
        />
      </div>
    )}
    </>
  );
}
