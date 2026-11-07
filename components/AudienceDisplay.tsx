'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlideView } from '@/components/SlideView';
import type { Slide } from '@/lib/slides';

export function AudienceDisplay({ slide, offline }: { slide?: Slide; offline: boolean }) {
  const popupRef = useRef<Window | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [error, setError] = useState('');
  useEffect(() => () => { popupRef.current?.close(); }, []);

  function open() {
    if (popupRef.current && !popupRef.current.closed) { popupRef.current.focus(); return; }
    const popup = window.open('', '_blank', 'popup,width=1280,height=720');
    if (!popup) { setError('Allow pop-ups for Podium to open the audience window.'); return; }
    popupRef.current = popup;
    popup.document.title = 'Podium audience display';
    popup.document.body.style.cssText = 'margin:0;background:#09090b;color:white;height:100vh;overflow:hidden';
    const root = popup.document.createElement('div');
    root.style.cssText = 'height:100%;display:flex;flex-direction:column';
    popup.document.body.append(root);
    popup.addEventListener('pagehide', () => setTarget(null), { once: true });
    setTarget(root);
    setError('');
  }

  return <div className="border-b border-[var(--border)] px-5 py-2 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="truncate">Slide: {slide?.title ?? 'None'}</span>
      <button type="button" onClick={open} className="min-h-11 rounded-xl border border-[var(--border)] px-3">{target ? 'Show audience window' : 'Open audience window'}</button>
    </div>
    {offline && slide?.mediaType && <p className="text-xs text-[var(--muted)]">Linked images and YouTube videos need internet. Speech controls still work with cached audio.</p>}
    {error && <p role="alert">{error}</p>}
    {target && createPortal(<>
      <button style={{ alignSelf: 'flex-end', padding: 10, cursor: 'pointer' }} onClick={() => {
        const doc = target.ownerDocument;
        if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
        else void doc.documentElement.requestFullscreen?.().catch(() => {});
      }}>Toggle full screen</button>
      <div style={{ flex: 1, minHeight: 0 }}><SlideView key={slide?.id ?? 'empty'} slide={slide} /></div>
    </>, target)}
  </div>;
}
