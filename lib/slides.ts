export interface Slide {
  id: string;
  title: string;
  body?: string;
  mediaType?: 'image' | 'youtube';
  mediaUrl?: string;
}

export function safeImageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function youtubeEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    let id: string | null = null;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)$/)?.[1] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

export function validateSlide(slide: Slide): void {
  if (!slide.id || !slide.title.trim()) throw new Error('Give the slide a title.');
  if (slide.mediaType && !(slide.mediaType === 'image' ? safeImageUrl(slide.mediaUrl ?? '') : youtubeEmbedUrl(slide.mediaUrl ?? ''))) {
    throw new Error(slide.mediaType === 'image' ? 'Enter a full HTTPS image link.' : 'Enter a YouTube video link.');
  }
}

/** Updating a shared slide changes every section using it; removing only detaches this section. */
export function assignSlide<T extends { id: string; slide?: Slide }>(segments: T[], segmentId: string, slide: Slide | null): T[] {
  if (!segments.some((segment) => segment.id === segmentId)) throw new Error('Section not found.');
  if (slide) validateSlide(slide);
  return segments.map((segment) => {
    if (segment.id !== segmentId && (!slide || segment.slide?.id !== slide.id)) return segment;
    const next = { ...segment };
    if (slide) next.slide = slide;
    else delete next.slide;
    return next;
  });
}
