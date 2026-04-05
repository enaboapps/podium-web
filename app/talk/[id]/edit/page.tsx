'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface Segment {
  id: string;
  text: string;
}

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const updateSegments = useMutation(api.talks.updateSegments);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (talk) {
      setSegments(talk.segments.map((s) => ({ id: s.id, text: s.text })));
      nextIdRef.current = talk.segments.length;
    }
  }, [talk]);

  function markDirty() {
    setDirty(true);
    setSaved(false);
  }

  function updateText(segId: string, text: string) {
    setSegments((prev) => prev.map((s) => s.id === segId ? { ...s, text } : s));
    markDirty();
  }

  function addAfter(index: number) {
    const newId = String(Date.now()) + String(nextIdRef.current++);
    setSegments((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, { id: newId, text: '' });
      return next;
    });
    markDirty();
    // Focus the new textarea after render
    setTimeout(() => {
      document.getElementById(`seg-${newId}`)?.focus();
    }, 50);
  }

  function remove(segId: string) {
    setSegments((prev) => prev.filter((s) => s.id !== segId));
    markDirty();
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setSegments((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    markDirty();
  }

  function moveDown(index: number) {
    if (index === segments.length - 1) return;
    setSegments((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    markDirty();
  }

  async function save() {
    if (!clerkId || !dirty) return;
    setSaving(true);
    try {
      await updateSegments({
        id: id as Id<'talks'>,
        userId: clerkId,
        segments: segments.filter((s) => s.text.trim().length > 0),
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
        <a
          href={`/talk/${id}`}
          className="text-sm text-[var(--muted)]"
        >
          ← Back
        </a>
        <span className="text-sm font-semibold truncate mx-4 flex-1 text-center">{talk?.title}</span>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="text-sm font-semibold text-[var(--primary)] disabled:opacity-30 w-12 text-right"
        >
          {saving ? '…' : saved ? 'Saved' : 'Save'}
        </button>
      </header>

      {/* Segments */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {segments.map((seg, i) => (
          <div key={seg.id} className="bg-[var(--surface)] rounded-2xl overflow-hidden border border-[var(--border)]">
            <textarea
              id={`seg-${seg.id}`}
              value={seg.text}
              onChange={(e) => updateText(seg.id, e.target.value)}
              rows={3}
              className="w-full bg-transparent px-4 pt-4 pb-2 text-base text-[var(--foreground)] resize-none outline-none leading-relaxed"
              placeholder="Segment text…"
            />
            {/* Segment actions */}
            <div className="flex items-center justify-between px-3 pb-2 gap-1">
              <div className="flex gap-1">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="w-8 h-8 flex items-center justify-center text-[var(--muted)] disabled:opacity-20 text-sm rounded-lg hover:bg-[var(--surface-hover)]"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === segments.length - 1}
                  className="w-8 h-8 flex items-center justify-center text-[var(--muted)] disabled:opacity-20 text-sm rounded-lg hover:bg-[var(--surface-hover)]"
                >
                  ↓
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => addAfter(i)}
                  className="w-8 h-8 flex items-center justify-center text-[var(--muted)] text-lg rounded-lg hover:bg-[var(--surface-hover)]"
                  title="Add segment below"
                >
                  +
                </button>
                <button
                  onClick={() => remove(seg.id)}
                  disabled={segments.length === 1}
                  className="w-8 h-8 flex items-center justify-center text-[var(--muted)] hover:text-red-400 disabled:opacity-20 text-sm rounded-lg"
                  title="Delete segment"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add segment at end */}
        <button
          onClick={() => addAfter(segments.length - 1)}
          className="w-full py-3 rounded-2xl border border-dashed border-[var(--border)] text-[var(--muted)] text-sm hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          + Add segment
        </button>
      </main>
    </div>
  );
}
