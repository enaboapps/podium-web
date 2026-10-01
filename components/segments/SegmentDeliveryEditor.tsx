'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

interface SegmentDeliveryEditorProps {
  initialValue: SegmentDeliveryValue;
  segmentId: string;
  segmentText: string;
  ttsConfig: TTSConfig | null;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (segmentId: string, value: SegmentDeliveryValue) => Promise<void>;
}

export function SegmentDeliveryEditor({
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );

  function markDirty() {
    setDirty(true);
    setSavedBriefly(false);
    onDirtyChange?.(true);
  }

  function handleMoodChange(next: Mood | undefined) {
    setMood(next);
    markDirty();
  }

  function handlePaceChange(next: Pace | undefined) {
    setPace(next);
    markDirty();
  }

  function handleWordChange(next: DeliveryWord) {
    if (selectedIndex === null) return;
    setWords((previous) => previous.map((word, index) => (index === selectedIndex ? next : word)));
    markDirty();
  }

  function currentValue(): SegmentDeliveryValue {
    return { words: words.map(normaliseWord), mood, pace };
  }

  async function handleTest() {
    if (!ttsConfig) return;

    if (playState === 'playing') {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayState('idle');
      return;
    }

    setPlayState('loading');
    setPlayError(null);

    try {
      const blob = await fetchSegmentBlob({ text: segmentText, ...currentValue() }, ttsConfig);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayState('idle');
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPlayState('idle');
      };

      setPlayState('playing');
      await audio.play();
    } catch (error) {
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
        setPlayState('idle');
        setPlayError(null);
      }, 6000);
    }
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
