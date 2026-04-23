'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, WifiOff, Volume2, ChevronRight, ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { clearTalkAudio, getCachedAudio, getTalkData, saveTalkData, setCachedAudio } from '@/lib/audioStore';
import { getTalkPreparedState, saveTalkPreparedState } from '@/lib/offlineStore';
import { readTalkIndex, writeTalkIndex } from '@/lib/presentationState';
import { buildSSML, SegmentElement } from '@/lib/ssml';
import { fetchTTSBlob, TTSConfig } from '@/lib/tts';
import OfflineTalkPage from './OfflineTalkPage';

type SpeakState = 'idle' | 'loading' | 'speaking' | 'spoken';

const EARLY_START_THRESHOLD = 0.25; // unlock talk UI once this fraction of segments are cached

export default function OnlineTalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useOnlineCurrentUser();
  const { library } = useOfflineBoot();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');

  const [index, setIndex] = useState<number>(() => readTalkIndex(id) ?? 0);
  const [speakState, setSpeakState] = useState<SpeakState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrls = useRef<Map<number, string>>(new Map());
  const hasHydratedIndexRef = useRef(false);
  const [cacheLoaded, setCacheLoaded] = useState(0);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheFailed, setCacheFailed] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [forceOfflineFallback, setForceOfflineFallback] = useState(false);
  const [waitingForSegment, setWaitingForSegment] = useState(false);

  const provider = settings?.provider ?? 'elevenlabs';
  const isAzure = provider === 'azure';
  const ttsReady = isAzure
    ? !!(settings?.azureSubscriptionKey && settings?.azureRegion)
    : !!settings?.elevenLabsApiKey;

  const ttsConfig: TTSConfig | null = useMemo(() => (
    settings
      ? isAzure
        ? settings.azureSubscriptionKey && settings.azureRegion
          ? { provider: 'azure', subscriptionKey: settings.azureSubscriptionKey, region: settings.azureRegion, voiceId: settings.azureVoiceId }
          : null
        : settings.elevenLabsApiKey
          ? { provider: 'elevenlabs', apiKey: settings.elevenLabsApiKey, voiceId: settings.elevenLabsVoiceId }
          : null
      : null
  ), [isAzure, settings]);

  const effectiveTalk = talk ?? undefined;
  const segments = useMemo(() => effectiveTalk?.segments ?? [], [effectiveTalk]);
  const voiceKey = isAzure
    ? `azure:${settings?.azureVoiceId ?? 'default'}`
    : `elevenlabs:${settings?.elevenLabsVoiceId ?? 'default'}`;

  useEffect(() => {
    if (talk !== undefined) {
      setForceOfflineFallback(false);
      return;
    }

    if (!library) return;

    const timeout = setTimeout(() => {
      setForceOfflineFallback(true);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [library, talk]);

  useEffect(() => {
    if (!talk) return;

    const userId = clerkId;
    void saveTalkData(id, {
      _id: talk._id,
      title: talk.title,
      segments: talk.segments,
      voiceKey,
      updatedAt: Date.now(),
    });

    if (!userId) return;

    void (async () => {
      const existingStatus = await getTalkPreparedState(userId, id);
      await saveTalkPreparedState(userId, id, {
        talkId: id,
        hasDocument: true,
        hasAudio: existingStatus?.hasAudio ?? false,
        segmentCount: talk.segments.length,
        cachedAudioSegments: existingStatus?.cachedAudioSegments ?? 0,
        lastPreparedAt: existingStatus?.lastPreparedAt ?? null,
      });
    })();
  }, [clerkId, id, talk, voiceKey]);

  useEffect(() => {
    if (!ttsConfig || segments.length === 0 || !clerkId) return;

    const userId = clerkId;
    const activeTtsConfig = ttsConfig;
    const controller = new AbortController();
    const { signal } = controller;
    const currentAudioUrls = audioUrls.current;

    async function prepare() {
      // Clear stale audio if the voice has changed since the last download
      const storedTalk = await getTalkData(id);
      if (storedTalk?.voiceKey && storedTalk.voiceKey !== voiceKey) {
        await clearTalkAudio(id);
      }
      if (signal.aborted) return;

      const idbResults = await Promise.all(
        segments.map(async (segment, segmentIndex) => {
          const cacheKey = segment.elements
            ? `${voiceKey}:${id}:ssml:${JSON.stringify(segment.elements)}`
            : `${voiceKey}:${id}:${segment.text}`;
          return { segmentIndex, segment, cacheKey, blob: await getCachedAudio(cacheKey) };
        })
      );

      if (signal.aborted) return;

      const hits = idbResults.filter((result) => result.blob);
      const misses = idbResults.filter((result) => !result.blob);

      hits.forEach(({ segmentIndex, blob }) => {
        currentAudioUrls.set(segmentIndex, URL.createObjectURL(blob!));
      });

      if (misses.length === 0) {
        setCacheLoaded(segments.length);
        setCacheReady(true);
        setCacheChecked(true);
        await saveTalkPreparedState(userId, id, {
          talkId: id,
          hasDocument: true,
          hasAudio: true,
          segmentCount: segments.length,
          cachedAudioSegments: segments.length,
          lastPreparedAt: Date.now(),
        });
        return;
      }

      setCacheLoaded(hits.length);
      setCacheChecked(true);

      let completed = hits.length;
      let hadFailure = false;

      for (const { segmentIndex, cacheKey, segment } of misses) {
        if (signal.aborted) break;
        try {
          const ttsText = isAzure && segment.elements
            ? buildSSML(segment.elements as SegmentElement[])
            : segment.text;
          const blob = await fetchTTSBlob(ttsText, activeTtsConfig);
          if (signal.aborted) break;
          await setCachedAudio(cacheKey, blob);
          audioUrls.current.set(segmentIndex, URL.createObjectURL(blob));
        } catch (err) {
          if ((err as Error).name === 'AbortError') break;
          hadFailure = true;
          setCacheFailed(true);
        } finally {
          if (!signal.aborted) {
            completed++;
            setCacheLoaded(completed);
            if (completed === segments.length) setCacheReady(true);
          }
        }
      }

      await saveTalkPreparedState(userId, id, {
        talkId: id,
        hasDocument: true,
        hasAudio: !hadFailure && currentAudioUrls.size === segments.length,
        segmentCount: segments.length,
        cachedAudioSegments: currentAudioUrls.size,
        lastPreparedAt: currentAudioUrls.size > 0 ? Date.now() : null,
      });
    }

    void prepare();

    return () => {
      controller.abort();
      currentAudioUrls.forEach((url) => URL.revokeObjectURL(url));
      currentAudioUrls.clear();
    };
  }, [clerkId, id, isAzure, segments, ttsConfig, voiceKey]);

  // Stable identity string that changes when segment content or voice changes
  const audioIdentityKey = voiceKey + segments.map(s =>
    s.elements ? `ssml:${JSON.stringify(s.elements)}` : s.text
  ).join('|');

  // Reset cache state whenever the audio identity changes (voice or SSML update)
  useEffect(() => {
    setCacheReady(false);
    setCacheChecked(false);
    setCacheLoaded(0);
    setCacheFailed(false);
    setWaitingForSegment(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioIdentityKey]);

  const earlyStartReady =
    cacheChecked &&
    segments.length > 0 &&
    cacheLoaded >= Math.max(1, Math.ceil(segments.length * EARLY_START_THRESHOLD));

  // Auto-play when a segment the user is waiting on becomes available
  useEffect(() => {
    if (!waitingForSegment) return;
    if (audioUrls.current.has(index)) {
      setWaitingForSegment(false);
      void speakAt(index);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheLoaded, index, waitingForSegment]);

  // Persist current segment index so remounts (hard refresh, offline gate
  // flips) can resume the user where they were rather than jumping to 0.
  useEffect(() => {
    if (!hasHydratedIndexRef.current) {
      hasHydratedIndexRef.current = true;
      return; // skip writing the initial value we just read
    }
    writeTalkIndex(id, index);
  }, [id, index]);

  // If the talk was edited and now has fewer segments than the saved/current
  // index, clamp to the last valid segment so rendering never crashes on
  // `current.text`.
  useEffect(() => {
    if (segments.length > 0 && index >= segments.length) {
      setIndex(Math.max(0, segments.length - 1));
    }
  }, [segments.length, index]);

  const current = segments[index];
  const isLast = index === segments.length - 1;
  const isLocked = speakState === 'loading' || speakState === 'speaking';

  function doSpeak() {
    void speakAt(index);
  }

  function doAdvance() {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakState('idle');
    setIndex((prev) => prev + 1);
  }

  function doAdvanceAndSpeak() {
    audioRef.current?.pause();
    audioRef.current = null;
    const nextIndex = index + 1;
    setIndex(nextIndex);
    void speakAt(nextIndex);
  }

  async function speakAt(targetIndex: number) {
    const url = audioUrls.current.get(targetIndex);
    if (!url) {
      setWaitingForSegment(true);
      setSpeakState('idle');
      return;
    }
    setWaitingForSegment(false);

    setSpeakState('loading');
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setSpeakState('spoken');
    audio.onerror = () => setSpeakState('idle');

    try {
      setSpeakState('speaking');
      await audio.play();
    } catch {
      setSpeakState('idle');
    }
  }

  function back() {
    if (isLocked || index === 0) return;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakState('idle');
    setIndex((prev) => prev - 1);
  }

  if (forceOfflineFallback && library) {
    return <OfflineTalkPage params={params} />;
  }

  if (effectiveTalk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading...</p>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">No segments in this talk.</p>
        <a href="/library" className="text-[var(--primary)] text-sm">Back to library</a>
      </div>
    );
  }

  if (ttsReady && cacheChecked && !earlyStartReady) {
    const progress = segments.length > 0 ? cacheLoaded / segments.length : 0;
    const percent = Math.round(progress * 100);

    return (
      <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <a href="/library" className="text-sm text-[var(--muted)]">Back to library</a>
          <span className="text-xs text-[var(--muted)] truncate mx-4">{effectiveTalk.title}</span>
          <div className="w-12" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
          {/* Animated icon */}
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Download className="w-8 h-8 text-[var(--primary)]" strokeWidth={1.5} />
            </motion.div>
          </div>

          {/* Headline + explanation */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Downloading your talk</h2>
            <div className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
              <WifiOff className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>So it works without internet during your speech</span>
            </div>
          </div>

          {/* Progress */}
          <div className="w-full max-w-xs flex flex-col gap-3">
            <div className="flex items-end justify-between px-0.5">
              <span className="text-3xl font-bold text-[var(--foreground)] tabular-nums">{percent}%</span>
              <span className="text-sm text-[var(--muted)] pb-1">{cacheLoaded} of {segments.length} sections</span>
            </div>
            <div className="h-3 bg-[var(--border)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--primary)] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-[var(--muted)] text-center">Please keep this screen open</p>
          </div>

          {cacheFailed && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-[var(--muted)]">Some sections couldn&apos;t be downloaded.</p>
              <button
                onClick={() => setCacheReady(true)}
                className="text-sm font-medium text-[var(--primary)] underline underline-offset-2"
              >
                Continue anyway
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const noTTSMessage = isAzure ? 'Add Azure credentials in Settings' : 'Add ElevenLabs key in Settings';

  const speakButtonLabel =
    waitingForSegment ? 'Preparing...' :
    speakState === 'loading' ? 'Loading...' :
    speakState === 'speaking' ? 'Speaking...' :
    speakState === 'spoken' ? (isLast ? 'Done!' : 'Next') :
    ttsReady ? 'Speak' : noTTSMessage;

  const speakButtonDisabled = !ttsReady || isLocked || waitingForSegment || (speakState === 'spoken' && isLast);

  function handleSpeakButton() {
    if (speakState === 'spoken' && !isLast) {
      doAdvanceAndSpeak();
    } else if (speakState === 'idle') {
      doSpeak();
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <a
          href="/library"
          className={`text-sm transition-colors ${isLocked ? 'pointer-events-none text-transparent' : 'text-[var(--muted)]'}`}
        >
          Back to library
        </a>
        <span className="text-xs text-[var(--muted)]">
          {index + 1} / {segments.length}
        </span>
        <a
          href={`/talk/${id}/edit`}
          className={`text-xs w-12 text-right transition-colors ${isLocked ? 'pointer-events-none text-transparent' : 'text-[var(--muted)]'}`}
        >
          Edit
        </a>
      </header>

      <div className="h-1 bg-[var(--border)]">
        <div
          className="h-full bg-[var(--primary)] rounded-r-full transition-all duration-300"
          style={{ width: `${((index + 1) / segments.length) * 100}%` }}
        />
      </div>

      {/* Background download banner */}
      <AnimatePresence>
        {earlyStartReady && !cacheReady && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-5 py-2 bg-[var(--surface)] border-b border-[var(--border)]">
              <Download className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" strokeWidth={1.5} />
              <div className="flex-1 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--primary)]/50 rounded-full"
                  animate={{ width: `${(cacheLoaded / segments.length) * 100}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              <span className="text-xs text-[var(--muted)] tabular-nums shrink-0">
                {cacheLoaded}/{segments.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Segment text */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center px-8 py-8">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={`px-6 py-8 rounded-3xl transition-all duration-500 ${
            speakState === 'speaking' ? 'ring-2 ring-[var(--primary)]/30 bg-[var(--surface)]' : ''
          }`}
        >
          <p className="text-3xl leading-snug font-semibold text-center text-[var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
            {current.text}
          </p>
        </motion.div>
        </div>
      </div>

      {/* Next segment preview */}
      <AnimatePresence mode="wait">
        {!isLast && (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-baseline gap-2 px-6 py-2"
          >
            <span className="text-xs text-[var(--muted)] shrink-0">Next</span>
            <span className="text-sm text-[var(--muted)]/70 truncate">{segments[index + 1]?.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav row — back | speak/next | forward */}
      <div className="flex items-center gap-3 px-6 pt-4 pb-10">
        <button
          onClick={back}
          disabled={isLocked || index === 0}
          className="w-14 h-14 shrink-0 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] disabled:opacity-20 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <motion.button
          onClick={handleSpeakButton}
          disabled={speakButtonDisabled}
          whileTap={speakButtonDisabled ? {} : { scale: 0.97 }}
          className={`flex-1 h-14 rounded-full flex items-center justify-center gap-2 text-base font-semibold transition-colors duration-200 ${
            speakState === 'speaking'
              ? 'bg-[var(--primary)]/20 text-[var(--primary)] cursor-default'
              : speakButtonDisabled
              ? 'bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] cursor-default'
              : 'bg-[var(--primary)] text-white'
          }`}
        >
          <AnimatePresence mode="wait">
            {speakState === 'speaking' ? (
              <motion.span key="speaking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                <motion.div animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  <Volume2 className="w-4 h-4" />
                </motion.div>
                Speaking...
              </motion.span>
            ) : speakState === 'spoken' && !isLast ? (
              <motion.span key="next" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                Next <ChevronRight className="w-4 h-4" />
              </motion.span>
            ) : speakState === 'idle' && ttsReady ? (
              <motion.span key="speak" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" /> Speak
              </motion.span>
            ) : (
              <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {speakButtonLabel}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <button
          onClick={() => { if (!isLast) doAdvance(); }}
          disabled={isLocked || isLast}
          className="w-14 h-14 shrink-0 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] disabled:opacity-20 active:scale-95 transition-transform"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {speakState === 'spoken' && isLast && (
        <div className="flex justify-center pb-6 -mt-4">
          <a href="/library" className="text-sm text-[var(--primary)] font-medium">Back to library</a>
        </div>
      )}
    </div>
  );
}
