'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, WifiOff, Volume2, ChevronRight, ChevronsLeft, ArrowLeft, ArrowRight } from 'lucide-react';
import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useOfflineBoot } from '@/hooks/useOfflineBoot';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { clearTalkAudio, getCachedAudio, getTalkData, saveTalkData, setCachedAudio, type CachedTalk } from '@/lib/audioStore';
import { getTalkPreparedState, saveTalkPreparedState } from '@/lib/offlineStore';
import { readTalkIndex, writeTalkIndex } from '@/lib/presentationState';
import { buildSSML, SegmentElement } from '@/lib/ssml';
import { fetchTTSBlob, TTSConfig } from '@/lib/tts';

type SpeakState = 'idle' | 'loading' | 'speaking' | 'spoken';

const EARLY_START_THRESHOLD = 0.25; // unlock talk UI once this fraction of segments are cached
const OFFLINE_UNAVAILABLE_DELAY_MS = 2500;

type TalkSegment = CachedTalk['segments'][number];

function getSegmentAudioCacheKey(voiceKey: string, talkId: string, segment: TalkSegment) {
  return segment.elements
    ? `${voiceKey}:${talkId}:ssml:${JSON.stringify(segment.elements)}`
    : `${voiceKey}:${talkId}:${segment.text}`;
}

export default function OnlineTalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useOnlineCurrentUser();
  const { isOnline, library, mode } = useOfflineBoot();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');

  const [cachedTalkRecord, setCachedTalkRecord] = useState<{ id: string; talk: CachedTalk | null } | undefined>(undefined);
  const [offlineUnavailableId, setOfflineUnavailableId] = useState<string | null>(null);
  const [index, setIndex] = useState<number>(() => readTalkIndex(id) ?? 0);
  const [speakState, setSpeakState] = useState<SpeakState>('idle');
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrls = useRef<Map<number, string>>(new Map());
  const hasHydratedIndexRef = useRef(false);
  const [cacheLoaded, setCacheLoaded] = useState(0);
  const [cachedAudioCount, setCachedAudioCount] = useState(0);
  const [availableAudioIndexes, setAvailableAudioIndexes] = useState<Set<number>>(() => new Set());
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheFailed, setCacheFailed] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [generationInProgress, setGenerationInProgress] = useState(false);
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

  const settingsVoiceKey = settings
    ? isAzure
      ? `azure:${settings.azureVoiceId ?? 'default'}`
      : `elevenlabs:${settings.elevenLabsVoiceId ?? 'default'}`
    : undefined;
  const cachedTalk = cachedTalkRecord?.id === id ? cachedTalkRecord.talk : undefined;
  const resolvedVoiceKey = settingsVoiceKey ?? cachedTalk?.voiceKey;

  const effectiveTalk = talk ?? cachedTalk ?? undefined;
  const isShowingCachedTalk = !talk && !!cachedTalk;
  const segments = useMemo(() => effectiveTalk?.segments ?? [], [effectiveTalk]);

  useEffect(() => {
    let cancelled = false;

    async function loadCachedTalk() {
      const storedTalk = await getTalkData(id);
      if (cancelled) return;
      setCachedTalkRecord({ id, talk: storedTalk ?? null });
    }

    void loadCachedTalk();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (effectiveTalk !== undefined || cachedTalk === undefined || isOnline) return;

    const timeout = setTimeout(() => {
      setOfflineUnavailableId(id);
    }, OFFLINE_UNAVAILABLE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [cachedTalk, effectiveTalk, id, isOnline]);

  useEffect(() => {
    if (!talk) return;

    const userId = clerkId;
    void saveTalkData(id, {
      _id: talk._id,
      title: talk.title,
      segments: talk.segments,
      voiceKey: settingsVoiceKey,
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
  }, [clerkId, id, settingsVoiceKey, talk]);

  // Stable identity string that changes when segment content or voice changes.
  const audioIdentityKey = (resolvedVoiceKey ?? 'no-voice') + segments.map(s =>
    s.elements ? `ssml:${JSON.stringify(s.elements)}` : s.text
  ).join('|');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const currentAudioUrls = audioUrls.current;
    const activeVoiceKey = resolvedVoiceKey;

    async function scanCachedAudio() {
      await Promise.resolve();
      if (signal.aborted) return;

      setCacheReady(false);
      setCacheChecked(false);
      setCacheLoaded(0);
      setCachedAudioCount(0);
      setAvailableAudioIndexes(new Set());
      setCacheFailed(false);
      setWaitingForSegment(false);

      if (!activeVoiceKey || segments.length === 0) {
        setCacheChecked(true);
        return;
      }

      const idbResults = await Promise.all(
        segments.map(async (segment, segmentIndex) => {
          const cacheKey = getSegmentAudioCacheKey(activeVoiceKey, id, segment);
          return { segmentIndex, segment, cacheKey, blob: await getCachedAudio(cacheKey) };
        })
      );

      if (signal.aborted) return;

      const hits = idbResults.filter((result) => result.blob);

      hits.forEach(({ segmentIndex, blob }) => {
        currentAudioUrls.set(segmentIndex, URL.createObjectURL(blob!));
      });

      setCacheLoaded(hits.length);
      setCachedAudioCount(hits.length);
      setAvailableAudioIndexes(new Set(hits.map(({ segmentIndex }) => segmentIndex)));
      setCacheReady(hits.length === segments.length);
      setCacheChecked(true);
    }

    void scanCachedAudio();

    return () => {
      controller.abort();
      currentAudioUrls.forEach((url) => URL.revokeObjectURL(url));
      currentAudioUrls.clear();
    };
  }, [audioIdentityKey, id, resolvedVoiceKey, segments]);

  useEffect(() => {
    if (!resolvedVoiceKey || !settingsVoiceKey || !ttsConfig || segments.length === 0 || !clerkId || !isOnline) {
      const timeout = setTimeout(() => setGenerationInProgress(false), 0);
      return () => clearTimeout(timeout);
    }

    const userId = clerkId;
    const activeTtsConfig = ttsConfig;
    const activeSettingsVoiceKey = settingsVoiceKey;
    const controller = new AbortController();
    const { signal } = controller;

    async function prepareMissingAudio() {
      setGenerationInProgress(true);

      // Only clear stale voice audio when live settings are available. Offline
      // playback should never delete a cached voice that may be the only usable
      // speech on the device.
      const storedTalk = await getTalkData(id);
      if (storedTalk?.voiceKey && storedTalk.voiceKey !== activeSettingsVoiceKey) {
        await clearTalkAudio(id);
      }
      if (signal.aborted) return;

      let completed = audioUrls.current.size;
      let hadFailure = false;

      for (const [segmentIndex, segment] of segments.entries()) {
        if (signal.aborted) break;
        if (audioUrls.current.has(segmentIndex)) continue;

        const cacheKey = getSegmentAudioCacheKey(activeSettingsVoiceKey, id, segment);

        try {
          const ttsText = isAzure && segment.elements
            ? buildSSML(segment.elements as SegmentElement[])
            : segment.text;
          const blob = await fetchTTSBlob(ttsText, activeTtsConfig);
          if (signal.aborted) break;
          await setCachedAudio(cacheKey, blob);
          audioUrls.current.set(segmentIndex, URL.createObjectURL(blob));
          completed = audioUrls.current.size;
          setCacheLoaded(completed);
          setCachedAudioCount(completed);
          setAvailableAudioIndexes(new Set(audioUrls.current.keys()));
          if (completed === segments.length) setCacheReady(true);
        } catch (err) {
          if ((err as Error).name === 'AbortError') break;
          hadFailure = true;
          setCacheFailed(true);
        }
      }

      if (signal.aborted) return;

      const preparedCount = audioUrls.current.size;
      await saveTalkPreparedState(userId, id, {
        talkId: id,
        hasDocument: true,
        hasAudio: !hadFailure && preparedCount === segments.length,
        segmentCount: segments.length,
        cachedAudioSegments: preparedCount,
        lastPreparedAt: preparedCount > 0 ? Date.now() : null,
      });
      setGenerationInProgress(false);
    }

    void prepareMissingAudio();

    return () => {
      controller.abort();
      setGenerationInProgress(false);
    };
  }, [audioIdentityKey, clerkId, id, isAzure, isOnline, resolvedVoiceKey, segments, settingsVoiceKey, ttsConfig]);

  useEffect(() => {
    if (!clerkId || segments.length === 0 || !cacheChecked) return;

    void saveTalkPreparedState(clerkId, id, {
      talkId: id,
      hasDocument: true,
      hasAudio: cachedAudioCount === segments.length,
      segmentCount: segments.length,
      cachedAudioSegments: cachedAudioCount,
      lastPreparedAt: cachedAudioCount > 0 ? Date.now() : null,
    });
  }, [cacheChecked, cachedAudioCount, clerkId, id, segments.length]);

  const earlyStartReady =
    cacheChecked &&
    segments.length > 0 &&
    cacheLoaded >= Math.max(1, Math.ceil(segments.length * EARLY_START_THRESHOLD));

  const speakAt = useCallback(async (targetIndex: number) => {
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
  }, []);

  // Auto-play when a segment the user is waiting on becomes available
  useEffect(() => {
    if (!waitingForSegment) return;
    if (audioUrls.current.has(index)) {
      const timeout = setTimeout(() => {
        setWaitingForSegment(false);
        void speakAt(index);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [cacheLoaded, index, speakAt, waitingForSegment]);

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
      const timeout = setTimeout(() => setIndex(Math.max(0, segments.length - 1)), 0);
      return () => clearTimeout(timeout);
    }
  }, [segments.length, index]);

  const current = segments[index];
  const isLast = index === segments.length - 1;
  const isLocked = speakState === 'loading' || speakState === 'speaking';
  const currentSegmentHasAudio = availableAudioIndexes.has(index);
  const canPrepareCurrentSegment = isOnline && !!ttsConfig && generationInProgress;
  const missingSpeechForCurrentSegment = cacheChecked && !currentSegmentHasAudio;
  const offlinePresentation = !isOnline || mode === 'offline-emergency' || isShowingCachedTalk;

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

  function back() {
    if (isLocked || index === 0) return;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakState('idle');
    setIndex((prev) => prev - 1);
  }

  function goToStart() {
    if (isLocked || index === 0) return;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakState('idle');
    setIndex(0);
    setShowRestartConfirm(false);
  }

  if (effectiveTalk === undefined) {
    if (offlineUnavailableId === id && !library) {
      return (
        <OfflineUnavailable
          title="Talk unavailable offline"
          message="This talk was not prepared on this device before going offline."
          href="/library"
          actionLabel="Back to library"
        />
      );
    }

    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">
          {isOnline ? 'Loading...' : 'Loading cached talk...'}
        </p>
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

  if (isOnline && ttsReady && generationInProgress && cacheChecked && !earlyStartReady) {
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
    waitingForSegment || (missingSpeechForCurrentSegment && canPrepareCurrentSegment) ? 'Preparing...' :
    missingSpeechForCurrentSegment && !isOnline ? 'Speech unavailable offline' :
    missingSpeechForCurrentSegment ? 'Speech unavailable' :
    speakState === 'loading' ? 'Loading...' :
    speakState === 'speaking' ? 'Speaking...' :
    speakState === 'spoken' ? (isLast ? 'Done!' : 'Next') :
    currentSegmentHasAudio ? 'Speak' :
    ttsReady ? 'Preparing...' : noTTSMessage;

  const speakButtonDisabled =
    isLocked ||
    waitingForSegment ||
    (speakState === 'spoken' && isLast) ||
    (speakState !== 'spoken' && !currentSegmentHasAudio);

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

      {offlinePresentation && (
        <div className="border-y border-[var(--border)] bg-[var(--surface)]/80 px-5 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[var(--foreground)]">Offline</span>
            <span className="truncate text-xs text-[var(--muted)]">Using saved speech where available</span>
          </div>
        </div>
      )}

      <div className="h-1 bg-[var(--border)]">
        <div
          className="h-full bg-[var(--primary)] rounded-r-full transition-all duration-300"
          style={{ width: `${((index + 1) / segments.length) * 100}%` }}
        />
      </div>

      {/* Background download banner */}
      <AnimatePresence>
        {earlyStartReady && !cacheReady && isOnline && (
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

      {/* Nav row — restart | back | speak/next | forward */}
      <div className="flex items-center gap-3 px-6 pt-4 pb-10">
        <button
          onClick={() => setShowRestartConfirm(true)}
          disabled={isLocked || index === 0}
          aria-label="Back to start"
          className="w-14 h-14 shrink-0 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] disabled:opacity-20 active:scale-95 transition-transform"
        >
          <ChevronsLeft className="w-5 h-5" />
        </button>

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
            ) : speakState === 'idle' && currentSegmentHasAudio ? (
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

      {showRestartConfirm && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/60"
            onClick={() => setShowRestartConfirm(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-40 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Restart talk from the beginning?</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">This will jump back to the first segment.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowRestartConfirm(false)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                onClick={goToStart}
                className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                Restart
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
