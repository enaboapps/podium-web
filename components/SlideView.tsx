'use client';

import { useState } from 'react';
import { safeImageUrl, youtubeEmbedUrl, type Slide } from '@/lib/slides';

export function SlideView({ slide }: { slide?: Slide }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const image = slide?.mediaType === 'image' ? safeImageUrl(slide.mediaUrl ?? '') : null;
  const video = slide?.mediaType === 'youtube' ? youtubeEmbedUrl(slide.mediaUrl ?? '') : null;
  return <article style={{ boxSizing: 'border-box', width: '100%', height: '100%', padding: '4vmin', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2vmin', overflow: 'auto', background: '#09090b', color: '#fafafa', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
    {slide ? <>
      <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vmin, 64px)' }}>{slide.title}</h1>
      {slide.body && <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 'clamp(18px, 3vmin, 40px)' }}>{slide.body}</p>}
      {image && (failedUrl === image ? <p role="status">Image could not load. Check the link and internet connection.</p> :
        // Linked images must load directly, including hosts not known at build time.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={slide.title} referrerPolicy="no-referrer" onError={() => setFailedUrl(image)} style={{ minHeight: 0, maxHeight: '70%', maxWidth: '100%', objectFit: 'contain' }} />)}
      {video && <iframe title={slide.title} src={video} referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen style={{ width: '100%', flex: 1, minHeight: 200, border: 0 }} />}
    </> : <span aria-label="No slide for this section" />}
  </article>;
}
