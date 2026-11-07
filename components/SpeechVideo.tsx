'use client';

import { useEffect, useRef, useState } from 'react';
import { loadYouTubeAPI, type YouTubePlayer } from '@/lib/youtubePlayer';

export type VideoSpeechState = 'idle' | 'loading' | 'speaking' | 'spoken';

/** The player stays mounted across sections that share a slide. */
export function SpeechVideo({ embedUrl, title, speechState, compact }: {
  embedUrl: string; title: string; speechState: VideoSpeechState; compact: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const stateRef = useRef(speechState);
  const [notice, setNotice] = useState('');
  const [apiFailed, setApiFailed] = useState(false);

  useEffect(() => {
    stateRef.current = speechState;
    if (speechState === 'loading' || speechState === 'speaking') playerRef.current?.pauseVideo();
    if (speechState === 'spoken') playerRef.current?.playVideo();
  }, [speechState]);

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayer | undefined;
    void loadYouTubeAPI().then((api) => {
      if (cancelled || !hostRef.current) return;
      const placeholder = document.createElement('div');
      hostRef.current.replaceChildren(placeholder);
      player = new api.Player(placeholder, {
        videoId: new URL(embedUrl).pathname.split('/').pop()!,
        host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%',
        playerVars: { origin: window.location.origin, playsinline: 1 },
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            playerRef.current = target;
            const iframe = hostRef.current?.querySelector('iframe');
            if (iframe) iframe.title = title;
            if (stateRef.current === 'spoken') target.playVideo();
          },
          onAutoplayBlocked: () => {
            if (!cancelled) setNotice('Speech finished. Press Play on the video to start it.');
          },
          onStateChange: ({ data }) => {
            if (!cancelled && data === 1) setNotice('');
          },
          onError: () => {
            if (!cancelled) setNotice('This video could not play. Check the link and internet connection.');
          },
        },
      });
    }).catch(() => {
      if (!cancelled) {
        setApiFailed(true);
        setNotice('Automatic playback is unavailable. Use the video\'s Play button.');
      }
    });
    return () => {
      cancelled = true;
      playerRef.current = null;
      player?.destroy();
    };
  }, [embedUrl, title]);

  return <>
    {apiFailed ? <iframe title={title} src={embedUrl} referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen style={{ width: '100%', flex: 1, minHeight: compact ? 180 : 200, border: 0 }} /> :
      <div ref={hostRef} aria-label={title} style={{ width: '100%', flex: 1, minHeight: compact ? 180 : 200 }} />}
    <p role="status" style={{ margin: 0, fontSize: 14 }}>{notice || 'Video plays after this section\'s speech.'}</p>
  </>;
}
