export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

export interface YouTubePlayerOptions {
  videoId: string;
  host: string;
  width: string;
  height: string;
  playerVars: { origin: string; playsinline: number };
  events: {
    onReady: (event: { target: YouTubePlayer }) => void;
    onAutoplayBlocked: () => void;
    onStateChange: (event: { data: number }) => void;
    onError: () => void;
  };
}

interface YouTubeAPI {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YouTubeAPI> | undefined;

/** Load the official player API once, retaining any existing ready callback. */
export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YouTubeAPI>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (window.YT?.Player) resolve(window.YT);
      previousReady?.();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      window.onYouTubeIframeAPIReady = previousReady;
      script.remove();
      loading = undefined;
      reject(new Error('YouTube player could not load.'));
    };
    document.head.append(script);
  });
  return loading;
}
