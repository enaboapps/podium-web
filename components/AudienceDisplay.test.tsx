import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AudienceDisplay } from './AudienceDisplay';

afterEach(cleanup);

it('explains blocked audience popups without disrupting the presenter', () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  render(<AudienceDisplay offline={false} slide={{ id: '1', title: 'Hello' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open audience window' }));
  expect(screen.getByRole('alert').textContent).toContain('Allow pop-ups');
});

it('synchronizes slides, preserves a shared video player, and closes the audience window on exit', () => {
  const doc = document.implementation.createHTMLDocument();
  const close = vi.fn();
  const listeners = new Map<string, () => void>();
  vi.spyOn(window, 'open').mockReturnValue({ document: doc, close, closed: false, addEventListener: (event: string, fn: () => void) => listeners.set(event, fn) } as unknown as Window);
  const slide = { id: 'shared', title: 'Video', mediaType: 'youtube' as const, mediaUrl: 'https://youtu.be/dQw4w9WgXcQ' };
  const { rerender, unmount } = render(<AudienceDisplay offline={false} slide={slide} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open audience window' }));
  const iframe = doc.querySelector('iframe');
  expect(iframe).not.toBeNull();
  expect(doc.body.textContent).not.toContain('private script');
  rerender(<AudienceDisplay offline={false} slide={{ ...slide }} />);
  expect(doc.querySelector('iframe')).toBe(iframe);
  rerender(<AudienceDisplay offline={false} slide={{ id: 'next', title: 'Next slide' }} />);
  expect(doc.querySelector('iframe')).toBeNull();
  expect(doc.querySelector('h1')?.textContent).toBe('Next slide');
  act(() => listeners.get('pagehide')?.());
  expect(screen.getByRole('button', { name: 'Open audience window' })).toBeTruthy();
  unmount();
  expect(close).toHaveBeenCalledOnce();
});
