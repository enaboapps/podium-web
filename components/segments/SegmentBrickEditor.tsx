'use client';

import { useEffect, useRef, useState } from 'react';
import {
  applyModeEffect,
  EditorMode,
  getModeEffect,
  PlayState,
} from '@/lib/segmentEditorStyles';
import { SegmentElement, WordAnnotation, buildElements, buildSSML } from '@/lib/ssml';
import { fetchTTSBlob, TTSConfig } from '@/lib/tts';
import { SegmentEditorFooter } from './SegmentEditorFooter';
import { SegmentModeStrip } from './SegmentModeStrip';
import { SegmentWordCanvas } from './SegmentWordCanvas';

interface SegmentBrickEditorProps {
  initialAnnotations: WordAnnotation[];
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (segmentId: string, elements: SegmentElement[]) => Promise<void>;
  segmentId: string;
  ttsConfig: TTSConfig | null;
}

export function SegmentBrickEditor({
  initialAnnotations,
  onDirtyChange,
  onSave,
  segmentId,
  ttsConfig,
}: SegmentBrickEditorProps) {
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [activeMode, setActiveMode] = useState<EditorMode | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [playError, setPlayError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedBriefly, setSavedBriefly] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );

  function toggleMode(mode: EditorMode) {
    setAnchorId(null);
    setActiveMode((previousMode) => (previousMode === mode ? null : mode));
  }

  function markDirty() {
    setDirty(true);
    setSavedBriefly(false);
    onDirtyChange?.(true);
  }

  function handleWordTap(annotation: WordAnnotation) {
    if (!activeMode) return;

    if (anchorId === null) {
      setAnchorId(annotation.id);
      return;
    }

    const effect = getModeEffect(activeMode);
    const anchorIndex = annotations.findIndex((candidate) => candidate.id === anchorId);
    const tapIndex = annotations.findIndex((candidate) => candidate.id === annotation.id);
    const start = Math.min(anchorIndex, tapIndex);
    const end = Math.max(anchorIndex, tapIndex);

    setAnnotations((previousAnnotations) => previousAnnotations.map((candidate, index) => (
      index >= start && index <= end ? applyModeEffect(candidate, effect) : candidate
    )));
    setAnchorId(null);
    setActiveMode(null);
    markDirty();
  }

  function handlePauseChipTap(id: string) {
    setAnnotations((previousAnnotations) => previousAnnotations.map((annotation) => (
      annotation.id === id ? { ...annotation, pauseAfterMs: null } : annotation
    )));
    markDirty();
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
      const blob = await fetchTTSBlob(buildSSML(buildElements(annotations)), ttsConfig);
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
          ? 'Azure key invalid'
          : message.includes('429')
            ? 'Quota reached'
            : 'Test failed'
      );
      setPlayState('error');
      setTimeout(() => {
        setPlayState('idle');
        setPlayError(null);
      }, 3000);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(segmentId, buildElements(annotations));
      setDirty(false);
      onDirtyChange?.(false);
      setSavedBriefly(true);
      setTimeout(() => setSavedBriefly(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SegmentModeStrip
        activeMode={activeMode}
        anchorId={anchorId}
        onModeToggle={toggleMode}
        onCancelAnchor={() => setAnchorId(null)}
      />
      <SegmentWordCanvas
        activeMode={!!activeMode}
        anchorId={anchorId}
        annotations={annotations}
        onWordTap={handleWordTap}
        onPauseTap={handlePauseChipTap}
      />
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
