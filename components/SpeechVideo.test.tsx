import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SpeechVideo } from './SpeechVideo';
import { loadYouTubeAPI, type YouTubePlayerOptions } from '@/lib/youtubePlayer';

vi.mock('@/lib/youtubePlayer', () => ({ loadYouTubeAPI: vi.fn() }));

const play = vi.fn();
const pause = vi.fn();
const destroy = vi.fn();
let options: YouTubePlayerOptions | undefined;
class Player {
  playVideo = play;
  pauseVideo = pause;
  destroy = destroy;
  constructor(element: HTMLElement, config: YouTubePlayerOptions) {
    options = config;
    element.replaceWith(document.createElement('iframe'));
  }
}
const props = { embedUrl: 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE', title: 'Video', compact: true };
beforeEach(() => {
  options = undefined;
  play.mockClear(); pause.mockClear(); destroy.mockClear();
  vi.mocked(loadYouTubeAPI).mockResolvedValue({ Player });
});
afterEach(cleanup);

async function ready() {
  await waitFor(() => expect(options).toBeDefined());
  act(() => options!.events.onReady({ target: { playVideo: play, pauseVideo: pause, destroy } }));
}

it('waits for speech to finish, then starts the embedded video and pauses it for the next speech', async () => {
  const { rerender } = render(<SpeechVideo {...props} speechState="idle" />);
  await ready();
  expect(play).not.toHaveBeenCalled();
  rerender(<SpeechVideo {...props} speechState="speaking" />);
  expect(pause).toHaveBeenCalledOnce();
  expect(play).not.toHaveBeenCalled();
  rerender(<SpeechVideo {...props} speechState="spoken" />);
  expect(play).toHaveBeenCalledOnce();
  rerender(<SpeechVideo {...props} speechState="spoken" />);
  expect(play).toHaveBeenCalledOnce();
  // Advancing to another section sharing this slide preserves its player.
  rerender(<SpeechVideo {...props} speechState="idle" />);
  expect(play).toHaveBeenCalledOnce();
  expect(destroy).not.toHaveBeenCalled();
  rerender(<SpeechVideo {...props} speechState="loading" />);
  expect(pause).toHaveBeenCalledTimes(2);
});

it('starts after player readiness when speech finishes while the player is loading', async () => {
  const { rerender } = render(<SpeechVideo {...props} speechState="speaking" />);
  await waitFor(() => expect(options).toBeDefined());
  rerender(<SpeechVideo {...props} speechState="spoken" />);
  expect(play).not.toHaveBeenCalled();
  await ready();
  expect(play).toHaveBeenCalledOnce();
});

it('does not start a video for a completion belonging to a section already left', async () => {
  const { rerender } = render(<SpeechVideo {...props} speechState="spoken" />);
  await waitFor(() => expect(options).toBeDefined());
  rerender(<SpeechVideo {...props} speechState="idle" />);
  await ready();
  expect(play).not.toHaveBeenCalled();
});

it('provides a manual-play hint if the browser blocks autoplay and clears it on playback', async () => {
  render(<SpeechVideo {...props} speechState="spoken" />);
  await ready();
  act(() => options!.events.onAutoplayBlocked());
  expect(screen.getByRole('status').textContent).toContain('Press Play');
  act(() => options!.events.onStateChange({ data: 1 }));
  expect(screen.getByRole('status').textContent).not.toContain('Press Play');
});

it('destroys the video when leaving its slide and ignores late player callbacks', async () => {
  const { unmount } = render(<SpeechVideo {...props} speechState="idle" />);
  await waitFor(() => expect(options).toBeDefined());
  unmount();
  expect(destroy).toHaveBeenCalledOnce();
  act(() => options!.events.onReady({ target: { playVideo: play, pauseVideo: pause, destroy } }));
  expect(play).not.toHaveBeenCalled();
});

it('retains a manual embed when the automatic-playback API cannot load', async () => {
  vi.mocked(loadYouTubeAPI).mockRejectedValueOnce(new Error('offline'));
  render(<SpeechVideo {...props} speechState="idle" />);
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Automatic playback is unavailable'));
  expect(screen.getByTitle('Video').getAttribute('src')).toBe(props.embedUrl);
});
