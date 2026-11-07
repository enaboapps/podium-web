'use client';

import { use, useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { OfflineGate } from '@/components/offline/OfflineGate';
import { SlideEditor } from '@/components/SlideEditor';
import { replaceCachedTalkDocument } from '@/lib/offlineTalkMaintenance';
import type { Slide } from '@/lib/slides';

export default function SlidesPage({ params }: { params: Promise<{ id: string }> }) {
  return <OfflineGate unavailableTitle="Slide editing unavailable offline" unavailableMessage="Connect to the internet to edit slides."><OnlineSlidesPage params={params} /></OfflineGate>;
}

function OnlineSlidesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const saveSlide = useMutation(api.talks.saveSectionSlide);
  const [editing, setEditing] = useState<{ segmentId: string; initial?: Slide } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!editing) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing]);

  async function save(segmentId: string, slide: Slide | null) {
    if (!talk) return;
    setBusy(true); setError('');
    try {
      const segments = await saveSlide({ id: id as Id<'talks'>, segmentId, slide });
      // Slide changes do not invalidate prepared speech or reset its offline status.
      try { await replaceCachedTalkDocument({ talkId: id, title: talk.title, segments }); }
      catch { setError('Slide saved online. The local copy could not be updated. Open the talk again before going offline.'); }
      setEditing(null);
    } catch (err) {
      setError('Could not save slide. Try again.');
      throw err;
    } finally { setBusy(false); }
  }
  const slides = Array.from(new Map(talk?.segments.flatMap((s) => s.slide ? [[s.slide.id, s.slide] as const] : []) ?? []).values());
  return <main className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
    <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] p-5">
      {editing ? <span className="text-sm text-[var(--muted)]">Save or cancel to return</span> : <a href={`/talk/${id}/edit`}>Back to editor</a>}
      <h1 className="text-lg font-semibold">Slides</h1>
    </header>
    <div className="mx-auto max-w-3xl space-y-5 p-5">
      {talk === undefined ? <p>Loading...</p> : talk === null ? <p>Talk not found.</p> : <>
        <h2 className="text-xl font-semibold">{talk.title}</h2>
        <p className="text-sm text-[var(--muted)]">Slides are optional. Each section can have its own slide or use one from another section. Sections with no slide show a blank audience screen. Your speech controls work as before.</p>
        <p className="text-sm text-[var(--muted)]">Unchanged sections keep their slides when you edit the script. Rewritten or re-split sections need their slides assigned again.</p>
        {error && <p role="alert">{error}</p>}
        {editing ? <>
          <p>Section {talk.segments.findIndex((s) => s.id === editing.segmentId) + 1}</p>
          <SlideEditor key={editing.segmentId} initial={editing.initial} sharedCount={talk.segments.filter((s) => s.slide?.id === editing.initial?.id && s.slide).length} onSave={(slide) => save(editing.segmentId, slide)} onCancel={() => setEditing(null)} />
        </> : talk.segments.map((segment, index) => <section key={segment.id} className="space-y-3 rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-semibold">Section {index + 1}</h3>
          <p className="line-clamp-3 text-sm text-[var(--muted)]">{segment.text}</p>
          <label className="block">Slide
            <select disabled={busy} value={segment.slide?.id ?? ''} onChange={(e) => { void save(segment.id, slides.find((s) => s.id === e.target.value) ?? null).catch(() => {}); }} className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
              <option value="">No slide</option>
              {slides.map((slide) => <option key={slide.id} value={slide.id}>{slide.title} · {talk.segments.filter((s) => s.slide?.id === slide.id).map((s) => talk.segments.indexOf(s) + 1).join(', ')}</option>)}
            </select>
          </label>
          <div className="flex gap-4">
            <button disabled={busy} className="min-h-11 text-[var(--primary)]" onClick={() => setEditing({ segmentId: segment.id })}>New slide</button>
            {segment.slide && <button disabled={busy} className="min-h-11 text-[var(--primary)]" onClick={() => setEditing({ segmentId: segment.id, initial: segment.slide })}>Edit slide</button>}
          </div>
        </section>)}
        {!talk.segments.length && <p>Add speech text in the editor first.</p>}
      </>}
    </div>
  </main>;
}
