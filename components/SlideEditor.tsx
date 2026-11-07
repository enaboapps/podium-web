'use client';

import { useState } from 'react';
import { type Slide, validateSlide } from '@/lib/slides';
import { SlideView } from '@/components/SlideView';

export function SlideEditor({ initial, sharedCount, onSave, onCancel }: {
  initial?: Slide; sharedCount: number; onSave: (slide: Slide) => Promise<void>; onCancel: () => void;
}) {
  const [slide, setSlide] = useState<Slide>(() => initial ?? { id: crypto.randomUUID(), title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  async function save() {
    setError('');
    try { validateSlide(slide); setSaving(true); await onSave(slide); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save slide. Try again.'); }
    finally { setSaving(false); }
  }
  return <section className="space-y-4 rounded-xl border border-[var(--border)] p-4">
    {sharedCount > 1 && <p>Saving updates this slide in all {sharedCount} sections that use it.</p>}
    <label className="block">Slide title<input autoFocus value={slide.title} onChange={(e) => setSlide({ ...slide, title: e.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3" /></label>
    <label className="block">Slide text<textarea value={slide.body ?? ''} onChange={(e) => setSlide({ ...slide, body: e.target.value })} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3" /></label>
    <label className="block">Media<select value={slide.mediaType ?? ''} onChange={(e) => {
      const next = { ...slide };
      if (e.target.value) next.mediaType = e.target.value as 'image' | 'youtube';
      else { delete next.mediaType; delete next.mediaUrl; }
      setSlide(next); setPreview(false);
    }} className="ml-3 min-h-11 rounded-lg bg-[var(--surface)] p-2"><option value="">None</option><option value="image">Image link</option><option value="youtube">YouTube video</option></select></label>
    {slide.mediaType && <label className="block">{slide.mediaType === 'image' ? 'HTTPS image link' : 'YouTube video link'}<input type="url" value={slide.mediaUrl ?? ''} onChange={(e) => { setSlide({ ...slide, mediaUrl: e.target.value }); setPreview(false); }} className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3" />
      <span className="text-xs text-[var(--muted)]">{slide.mediaType === 'image' ? 'Use a direct image link, not a webpage link.' : 'Videos play manually in the audience window. Some owners disable embedding.'} Linked media needs internet.</span></label>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <button disabled={saving} onClick={() => { try { validateSlide(slide); setPreview(!preview); setError(''); } catch (err) { setError((err as Error).message); } }} className="min-h-11 rounded-lg border border-[var(--border)] px-4">Preview</button>
      <button disabled={saving} onClick={save} className="min-h-11 rounded-lg bg-[var(--primary)] px-4 text-white">{saving ? 'Saving...' : 'Save slide'}</button>
      <button disabled={saving} onClick={onCancel} className="min-h-11 px-4">Cancel</button>
    </div>
    {preview && <div style={{ height: 360 }}><SlideView key={slide.id} slide={slide} /></div>}
  </section>;
}
