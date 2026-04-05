'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { splitIntoSentences, joinFullText } from '@/lib/parseFile';

type SegmentMode = 'paragraphs' | 'sentences';

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const saveEditedText = useMutation(api.talks.saveEditedText);

  const [fullText, setFullText] = useState('');
  const [mode, setMode] = useState<SegmentMode>('paragraphs');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

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

  async function handleSave() {
    if (!clerkId || !dirty) return;
    setSaving(true);
    try {
      const segments = previewSegments.map((text, i) => ({ id: String(i), text }));
      await saveEditedText({
        id: id as Id<'talks'>,
        userId: clerkId,
        fullText: joinFullText(paragraphs),
        segments,
        segmentMode: mode,
      });
      setDirty(false);
      setSaved(true);
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
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)] shrink-0">
        <a href={`/talk/${id}`} className="text-sm text-[var(--muted)]">← Back</a>
        <span className="text-sm font-semibold truncate mx-4 flex-1 text-center">{talk?.title}</span>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="text-sm font-semibold text-[var(--primary)] disabled:opacity-30 w-12 text-right"
        >
          {saving ? '…' : saved ? 'Saved' : 'Save'}
        </button>
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
          {previewSegments.slice(0, 20).map((text, i) => (
            <div
              key={i}
              className="shrink-0 w-52 bg-[var(--surface)] rounded-xl px-3 py-2 border border-[var(--border)]"
            >
              <p className="text-xs text-[var(--muted)] mb-1">{i + 1}</p>
              <p className="text-xs text-[var(--foreground)] leading-relaxed line-clamp-4">{text}</p>
            </div>
          ))}
          {previewSegments.length > 20 && (
            <div className="shrink-0 w-24 bg-[var(--surface)] rounded-xl px-3 py-2 border border-[var(--border)] flex items-center justify-center">
              <p className="text-xs text-[var(--muted)]">+{previewSegments.length - 20} more</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
