'use client';

import { Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DeliveryWord,
  getCapabilities,
  getCapabilityNotes,
  getMoodSupport,
  isStyledWord,
  Mood,
  MOODS,
  normaliseWord,
  Pace,
} from '@/lib/delivery';
import { fetchSegmentBlob, getAzureVoiceStyles, getSpeechTarget, TTSConfig } from '@/lib/tts';
import { DeliveryPresetPicker } from './DeliveryPresetPicker';
import { PlayState, SegmentEditorFooter } from './SegmentEditorFooter';
import { SegmentWordCanvas } from './SegmentWordCanvas';
import { WordDeliveryPanel } from './WordDeliveryPanel';

export interface SegmentDeliveryValue {
  words: DeliveryWord[];
  mood?: Mood;
  pace?: Pace;
}

/** A tiny silent WAV, played inside a tap so iOS lets the same element play later. */
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
/** Wait this long after the last mood or pace change before generating, to avoid spending credits on every tap. */
const AUTO_PLAY_DELAY_MS = 700;

export interface SegmentDeliveryEditorHandle {
  /** Save the current presets; rejects if saving fails. */
  save: () => Promise<void>;
}

interface SegmentDeliveryEditorProps {
  ref?: Ref<SegmentDeliveryEditorHandle>;
  initialValue: SegmentDeliveryValue;
  segmentId: string;
  segmentText: string;
  ttsConfig: TTSConfig | null;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (segmentId: string, value: SegmentDeliveryValue) => Promise<void>;
}

export function SegmentDeliveryEditor({
  ref,
  initialValue,
  segmentId,
  segmentText,
  ttsConfig,
  onDirtyChange,
  onSave,
}: SegmentDeliveryEditorProps) {
  const [words, setWords] = useState(initialValue.words);
  const [mood, setMood] = useState(initialValue.mood);
  const [pace, setPace] = useState(initialValue.pace);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [wordsOpen, setWordsOpen] = useState(() => initialValue.words.some(isStyledWord));
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [playError, setPlayError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedBriefly, setSavedBriefly] = useState(false);
  // One reused element: once unlocked by a tap, iOS lets it play after a network wait.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  // Bumped on every play or stop, so results from replaced requests are ignored.
  const playGenerationRef = useRef(0);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [azureStyles, setAzureStyles] = useState<string[] | undefined>();
  useEffect(() => {
    let cancelled = false;
    if (ttsConfig) void getAzureVoiceStyles(ttsConfig).then((styles) => { if (!cancelled) setAzureStyles(styles); });
    return () => { cancelled = true; };
  }, [ttsConfig]);

  const target = useMemo(() => (ttsConfig ? getSpeechTarget(ttsConfig, azureStyles) : null), [ttsConfig, azureStyles]);
  const capabilities = target ? getCapabilities(target) : null;
  const notes = target ? getCapabilityNotes(target) : {};
  const approximateMoods = target ? MOODS.filter((key) => getMoodSupport(target, key) === 'approx') : [];

  useEffect(
    () => () => {
      playGenerationRef.current++;
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    []
  );

  function getAudio() {
    audioRef.current ??= new Audio();
    return audioRef.current;
  }

  /** Call inside a tap handler, before any await. */
  function unlockAudio() {
    const audio = getAudio();
    if (audio.src) return;
    audio.src = SILENT_WAV;
    void audio.play().catch(() => {});
  }

  function stopPlayback() {
    playGenerationRef.current++;
    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    autoPlayTimerRef.current = null;
    audioRef.current?.pause();
    setPlayState('idle');
  }

  async function playValue(value: SegmentDeliveryValue) {
    if (!ttsConfig) return;
    const generation = ++playGenerationRef.current;
    const audio = getAudio();
    audio.pause();
    setPlayState('loading');
    setPlayError(null);

    try {
      const blob = await fetchSegmentBlob({ text: segmentText, ...value }, ttsConfig);
      if (generation !== playGenerationRef.current) return;

      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = URL.createObjectURL(blob);
      audio.src = audioUrlRef.current;
      const finish = () => {
        if (generation === playGenerationRef.current) setPlayState('idle');
      };
      audio.onended = finish;
      audio.onerror = finish;

      setPlayState('playing');
      await audio.play();
    } catch (error) {
      if (generation !== playGenerationRef.current) return;
      const message = error instanceof Error ? error.message : '';
      setPlayError(
        message.includes('401')
          ? 'Your voice key isn’t working. Check it in Settings.'
          : message.includes('429')
            ? 'You’ve run out of voice credits for now.'
            : 'Couldn’t play this segment. Try again.'
      );
      setPlayState('error');
      setTimeout(() => {
        if (generation !== playGenerationRef.current) return;
        setPlayState('idle');
        setPlayError(null);
      }, 6000);
    }
  }

  /** Stop what's playing and play the new version once the changes settle. */
  function scheduleAutoPlay(value: SegmentDeliveryValue) {
    if (!ttsConfig) return;
    unlockAudio();
    stopPlayback();
    setPlayState('loading');
    autoPlayTimerRef.current = setTimeout(() => {
      autoPlayTimerRef.current = null;
      void playValue(value);
    }, AUTO_PLAY_DELAY_MS);
  }

  function markDirty() {
    setDirty(true);
    setSavedBriefly(false);
    onDirtyChange?.(true);
  }

  function handleMoodChange(next: Mood | undefined) {
    setMood(next);
    markDirty();
    scheduleAutoPlay({ ...currentValue(), mood: next });
  }

  function handlePaceChange(next: Pace | undefined) {
    setPace(next);
    markDirty();
    scheduleAutoPlay({ ...currentValue(), pace: next });
  }

  function handleWordChange(next: DeliveryWord) {
    if (selectedIndex === null) return;
    setWords((previous) => previous.map((word, index) => (index === selectedIndex ? next : word)));
    markDirty();
  }

  function currentValue(): SegmentDeliveryValue {
    return { words: words.map(normaliseWord), mood, pace };
  }

  function handleTest() {
    if (!ttsConfig) return;
    if (playState === 'playing' || playState === 'loading') {
      stopPlayback();
      return;
    }
    unlockAudio();
    void playValue(currentValue());
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(segmentId, currentValue());
      setDirty(false);
      onDirtyChange?.(false);
      setSavedBriefly(true);
      setTimeout(() => setSavedBriefly(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function toggleWords() {
    setWordsOpen((open) => !open);
    setSelectedIndex(null);
  }

  useImperativeHandle(ref, () => ({ save: handleSave }));

  const selectedWord = selectedIndex !== null ? words[selectedIndex] : null;
  const styledCount = words.filter(isStyledWord).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <DeliveryPresetPicker
          mood={mood}
          pace={pace}
          moodSupport={capabilities?.mood ?? 'yes'}
          paceSupport={capabilities?.pace ?? 'yes'}
          moodNote={notes.mood}
          approximateMoods={capabilities?.mood === 'yes' ? approximateMoods : []}
          paceNote={notes.pace}
          onMoodChange={handleMoodChange}
          onPaceChange={handlePaceChange}
        />

        <section>
          <button
            onClick={toggleWords}
            aria-expanded={wordsOpen}
            aria-controls="segment-words"
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="flex-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Words</span>
              <span className="block pt-0.5 text-sm text-[var(--foreground)]">
                {styledCount > 0
                  ? `${styledCount} ${styledCount === 1 ? 'word' : 'words'} changed`
                  : 'Pauses, stress and spelling for single words'}
              </span>
            </span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-[var(--muted)] transition-transform ${wordsOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {wordsOpen ? (
            <div id="segment-words">
              <p className="px-4 text-xs text-[var(--muted)]">
                Tap a word to add a pause, stress it, spell it out or change how it’s said.
              </p>
              <SegmentWordCanvas
                words={words}
                selectedIndex={selectedIndex}
                onWordTap={(index) => setSelectedIndex((previous) => (previous === index ? null : index))}
              />
            </div>
          ) : null}
        </section>
      </div>

      {selectedWord ? (
        <WordDeliveryPanel
          key={selectedIndex}
          word={selectedWord}
          pauseNote={notes.pause}
          stressNote={notes.stress}
          onChange={handleWordChange}
          onClose={() => setSelectedIndex(null)}
        />
      ) : null}

      <SegmentEditorFooter
        dirty={dirty}
        playError={playError}
        playState={playState}
        savedBriefly={savedBriefly}
        saving={saving}
        ttsConfig={ttsConfig}
        onSave={handleSave}
        onTest={handleTest}
      />
    </div>
  );
}
