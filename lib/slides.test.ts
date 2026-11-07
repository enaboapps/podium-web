import { describe, expect, it } from 'vitest';
import { assignSlide, safeImageUrl, validateSlide, youtubeEmbedUrl, type Slide } from './slides';
import { getSegmentAudioIdentity } from './delivery';

const slide: Slide = { id: 'shared', title: 'Our story', mediaType: 'youtube', mediaUrl: 'https://youtu.be/dQw4w9WgXcQ' };

describe('slide URLs', () => {
  it.each([
    'https://youtu.be/dQw4w9WgXcQ?t=20',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=ignored',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
  ])('normalizes a supported video link: %s', (url) => {
    expect(youtubeEmbedUrl(url)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
  it.each(['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://evil.test/embed/dQw4w9WgXcQ', 'http://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/watch?v=invalid', 'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ'])('rejects unsafe or invalid video links: %s', (url) => {
    expect(youtubeEmbedUrl(url)).toBeNull();
  });
  it('allows HTTPS image URLs including signed query strings without allowing active content', () => {
    expect(safeImageUrl('https://example.com/image?signature=abc')).toBe('https://example.com/image?signature=abc');
    for (const url of ['data:image/svg+xml,test', 'javascript:alert(1)', 'http://example.com/a.png', 'https://user:pass@example.com/a.png', '/a.png']) expect(safeImageUrl(url)).toBeNull();
  });
  it('validates titles and selected media', () => {
    expect(() => validateSlide({ id: '1', title: ' ' })).toThrow();
    expect(() => validateSlide({ id: '1', title: 'Title', mediaType: 'image' })).toThrow();
    expect(() => validateSlide({ id: '1', title: 'Title' })).not.toThrow();
  });
});

describe('optional and shared slides', () => {
  const sections = [
    { id: 'one', text: 'Hello', mood: 'warm' as const, words: [{ text: 'Hello', stress: true }], slide },
    { id: 'two', text: 'World', slide },
    { id: 'three', text: 'End' },
  ];
  it('updates every section using a shared slide without changing delivery or audio identity', () => {
    const original = structuredClone(sections);
    const updated = assignSlide(sections, 'two', { ...slide, title: 'New title' });
    expect(updated[0].slide?.title).toBe('New title');
    expect(updated[1].slide?.title).toBe('New title');
    expect(updated[2]).toBe(sections[2]);
    expect(updated[0].words).toEqual(sections[0].words);
    expect(getSegmentAudioIdentity(updated[0])).toBe(getSegmentAudioIdentity(sections[0]));
    expect(sections).toEqual(original);
  });
  it('detaches only the selected section and can reuse a slide in another section', () => {
    const detached = assignSlide(sections, 'one', null);
    expect(detached[0]).not.toHaveProperty('slide');
    expect(detached[1].slide).toEqual(slide);
    const reused = assignSlide(detached, 'three', slide);
    expect(reused[2].slide).toEqual(slide);
  });
  it('creates an independent slide without changing the former shared slide', () => {
    const updated = assignSlide(sections, 'one', { id: 'new', title: 'Different' });
    expect(updated[1].slide).toEqual(slide);
    expect(updated[0].slide?.id).toBe('new');
  });
  it('rejects stale section IDs', () => {
    expect(() => assignSlide(sections, 'deleted', slide)).toThrow('Section not found');
  });
});
