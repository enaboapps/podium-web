'use client';

import { use, useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  SegmentElement,
  WordAnnotation,
  buildAnnotations,
  buildElements,
  buildSSML,
  tokenise,
} from '@/lib/ssml';
import { fetchTTSBlob, TTSConfig } from '@/lib/tts';

// ─── Types ───────────────────────────────────────────────────────────────────

type EditorMode = 'emphasis' | 'slow' | 'fast' | 'sayAs' | 'pause' | 'clear';
type PlayState  = 'idle' | 'loading' | 'playing' | 'error';

// ─── Constants ───────────────────────────────────────────────────────────────

const MODES: {
  key: EditorMode;
  label: string;
  off: string;   // button class when inactive
  on: string;    // button class when active
}[] = [
  { key: 'emphasis', label: 'Emphasise', off: 'bg-amber-900/20  text-amber-400  border border-amber-800/40',   on: 'bg-amber-600  text-white' },
  { key: 'slow',     label: 'Slow',      off: 'bg-blue-900/20   text-blue-400   border border-blue-800/40',    on: 'bg-blue-600   text-white' },
  { key: 'fast',     label: 'Fast',      off: 'bg-orange-900/20 text-orange-400 border border-orange-800/40',  on: 'bg-orange-500 text-white' },
  { key: 'sayAs',    label: 'Spell out', off: 'bg-teal-900/20   text-teal-400   border border-teal-800/40',    on: 'bg-teal-600   text-white' },
  { key: 'pause',    label: '+ Pause',   off: 'bg-purple-900/20 text-purple-400 border border-purple-800/40',  on: 'bg-purple-600 text-white' },
  { key: 'clear',    label: 'Clear',     off: 'bg-[var(--surface)] text-[var(--muted)] border border-transparent', on: 'bg-red-900/40 text-red-300 border border-red-600/40' },
];

const PAUSE_DURATIONS = [
  { label: '¼s', ms: 250  },
  { label: '½s', ms: 500  },
  { label: '1s',  ms: 1000 },
  { label: '2s',  ms: 2000 },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pauseLabel(ms: number) {
  if (ms <= 300) return '¼s';
  if (ms <= 750) return '½s';
  if (ms <= 1250) return '1s';
  return '2s';
}

function wordChipClass(ann: WordAnnotation, active: boolean): string {
  const base = 'min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium leading-tight transition-all active:scale-95';
  const ring = active ? ' ring-2 ring-white/30 ring-offset-1 ring-offset-[var(--background)]' : '';
  const { emphasis, rate, sayAs } = ann;
  const slow = rate !== null && rate < 1;
  const fast = rate !== null && rate >= 1;
  if (emphasis && slow) return `${base}${ring} bg-amber-900/40 border border-amber-500/60 text-amber-200 font-semibold underline underline-offset-2 decoration-blue-400/60`;
  if (emphasis && fast) return `${base}${ring} bg-amber-900/40 border border-amber-500/60 text-amber-200 font-semibold italic`;
  if (emphasis)         return `${base}${ring} bg-amber-900/40 border border-amber-500/60 text-amber-200 font-semibold`;
  if (slow)             return `${base}${ring} bg-blue-900/40   border border-blue-500/60   text-blue-200  underline underline-offset-2 decoration-blue-400/60`;
  if (fast)             return `${base}${ring} bg-orange-900/40 border border-orange-500/60 text-orange-200 italic`;
  if (sayAs)            return `${base}${ring} bg-teal-900/40   border border-teal-500/60   text-teal-200  tracking-widest`;
  return `${base}${ring} bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]`;
}

function effectDots(elements: SegmentElement[] | undefined) {
  if (!elements?.length) return [];
  return [
    { show: elements.some(e => e.type === 'emphasis-open'),               color: 'bg-amber-500'  },
    { show: elements.some(e => e.type === 'prosody-open' && e.rate < 1),  color: 'bg-blue-500'   },
    { show: elements.some(e => e.type === 'prosody-open' && e.rate >= 1), color: 'bg-orange-500' },
    { show: elements.some(e => e.type === 'say-as'),                      color: 'bg-teal-500'   },
    { show: elements.some(e => e.type === 'break'),                       color: 'bg-purple-500' },
  ].filter(d => d.show);
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function SegmentBrickEditor({
  segmentId,
  initialAnnotations,
  ttsConfig,
  onSave,
}: {
  segmentId: string;
  initialAnnotations: WordAnnotation[];
  ttsConfig: TTSConfig | null;
  onSave: (segmentId: string, elements: SegmentElement[]) => Promise<void>;
}) {
  const [annotations,   setAnnotations]   = useState(initialAnnotations);
  const [activeMode,    setActiveMode]    = useState<EditorMode | null>(null);
  const [anchorId,      setAnchorId]      = useState<string | null>(null);
  const [pausePickerId, setPausePickerId] = useState<string | null>(null);
  const [playState,     setPlayState]     = useState<PlayState>('idle');
  const [playError,     setPlayError]     = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [dirty,         setDirty]         = useState(false);
  const [savedBriefly,  setSavedBriefly]  = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggleMode(mode: EditorMode) {
    setPausePickerId(null);
    setAnchorId(null);
    setActiveMode(prev => prev === mode ? null : mode);
  }

  function markDirty() {
    setDirty(true);
    setSavedBriefly(false);
  }

  function handleWordTap(ann: WordAnnotation) {
    if (!activeMode) return;

    // Pause: single-word only, no range
    if (activeMode === 'pause') {
      if (ann.pauseAfterMs !== null) {
        setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, pauseAfterMs: null } : a));
        if (pausePickerId === ann.id) setPausePickerId(null);
      } else {
        setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, pauseAfterMs: 500 } : a));
        setPausePickerId(ann.id);
        setActiveMode(null);
      }
      markDirty();
      return;
    }

    // Range-picker: first tap sets anchor, second tap applies over range
    if (anchorId === null) {
      setAnchorId(ann.id);
      return;
    }

    const anchorIdx = annotations.findIndex(a => a.id === anchorId);
    const tapIdx    = annotations.findIndex(a => a.id === ann.id);
    const lo = Math.min(anchorIdx, tapIdx);
    const hi = Math.max(anchorIdx, tapIdx);

    setAnnotations(prev => prev.map((a, i) => {
      if (i < lo || i > hi) return a;
      switch (activeMode) {
        case 'emphasis': return { ...a, emphasis: true };
        case 'slow':     return { ...a, rate: 0.7 };
        case 'fast':     return { ...a, rate: 1.4 };
        case 'sayAs':    return { ...a, sayAs: 'characters' };
        case 'clear':    return { ...a, emphasis: false, rate: null, sayAs: null };
        default:         return a;
      }
    }));
    setAnchorId(null);
    markDirty();
  }

  function handlePauseChipTap(id: string) {
    setActiveMode(null);
    setPausePickerId(prev => prev === id ? null : id);
  }

  function updatePause(id: string, ms: number) {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, pauseAfterMs: ms } : a));
    markDirty();
  }

  function removePause(id: string) {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, pauseAfterMs: null } : a));
    setPausePickerId(null);
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
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setPlayState('idle'); };
      audio.onerror = () => { URL.revokeObjectURL(url); setPlayState('idle'); };
      setPlayState('playing');
      await audio.play();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setPlayError(
        msg.includes('401') ? 'Azure key invalid' :
        msg.includes('429') ? 'Quota reached'     :
        'Test failed'
      );
      setPlayState('error');
      setTimeout(() => { setPlayState('idle'); setPlayError(null); }, 3000);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(segmentId, buildElements(annotations));
      setDirty(false);
      setSavedBriefly(true);
      setTimeout(() => setSavedBriefly(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const pausePickerAnn = pausePickerId ? annotations.find(a => a.id === pausePickerId) : null;

  return (
    <div>
      {/* Mode strip — OR range-anchor hint — OR pause duration picker */}
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)]/60">
        {pausePickerAnn ? (
          <>
            <span className="text-xs text-[var(--muted)] shrink-0 mr-0.5">Pause:</span>
            {PAUSE_DURATIONS.map(({ label, ms }) => (
              <button
                key={ms}
                onClick={() => { updatePause(pausePickerAnn.id, ms); setPausePickerId(null); }}
                className={`h-10 px-3 rounded-xl text-sm font-medium shrink-0 transition-colors ${
                  pausePickerAnn.pauseAfterMs === ms
                    ? 'bg-purple-600 text-white'
                    : 'bg-[var(--surface)] text-[var(--foreground)]'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => removePause(pausePickerAnn.id)}
              className="h-10 px-3 rounded-xl text-sm font-medium bg-[var(--surface)] text-red-400 shrink-0"
            >
              Remove
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setPausePickerId(null)}
              className="h-10 px-3 text-sm text-[var(--muted)] shrink-0"
            >
              ✕
            </button>
          </>
        ) : anchorId ? (
          <>
            <span className="text-sm text-[var(--foreground)] shrink-0">Now tap the last word in the range</span>
            <div className="flex-1" />
            <button
              onClick={() => setAnchorId(null)}
              className="h-10 px-3 text-sm text-[var(--muted)] shrink-0"
            >
              ✕ Cancel
            </button>
          </>
        ) : (
          MODES.map(({ key, label, off, on }) => (
            <button
              key={key}
              onClick={() => toggleMode(key)}
              className={`h-10 px-3 rounded-xl text-sm font-medium shrink-0 transition-colors ${
                activeMode === key ? on : off
              }`}
            >
              {label}
            </button>
          ))
        )}
      </div>

      {/* Word canvas */}
      <div className={`flex flex-wrap gap-1.5 px-3 py-3 ${activeMode ? 'cursor-pointer' : ''}`}>
        {annotations.map((ann) => (
          <span key={ann.id} className="contents">
            <button
              onClick={() => handleWordTap(ann)}
              disabled={!activeMode}
              className={
                wordChipClass(ann, !!activeMode) +
                (!activeMode ? ' cursor-default' : '') +
                (ann.id === anchorId ? ' ring-2 ring-white ring-offset-1 ring-offset-[var(--background)] animate-pulse' : '')
              }
            >
              {ann.text}
            </button>
            {ann.pauseAfterMs !== null && (
              <button
                onClick={() => handlePauseChipTap(ann.id)}
                className="flex flex-col items-center justify-center mx-0.5 shrink-0"
                style={{ minWidth: 32, minHeight: 44 }}
                aria-label={`${pauseLabel(ann.pauseAfterMs)} pause — tap to edit`}
              >
                <div className={`w-0.5 h-4 rounded-full transition-colors ${
                  pausePickerId === ann.id ? 'bg-purple-300' : 'bg-purple-500/70'
                }`} />
                <span className="text-[9px] text-purple-400 mt-0.5 leading-none">
                  {pauseLabel(ann.pauseAfterMs)}
                </span>
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center px-4 py-3 border-t border-[var(--border)] gap-4">
        <button
          onClick={handleTest}
          disabled={!ttsConfig || playState === 'loading'}
          className={`text-sm font-medium disabled:opacity-40 transition-colors ${
            playState === 'playing' ? 'text-[var(--primary)]' :
            playState === 'error'   ? 'text-red-400'          :
            'text-[var(--muted)]'
          }`}
        >
          {playState === 'loading' ? 'Loading…'                     :
           playState === 'playing' ? '■ Stop'                       :
           playState === 'error'   ? (playError ?? 'Test failed')   :
           '▶ Test'}
        </button>

        {!ttsConfig && (
          <a href="/settings" className="text-xs text-[var(--primary)]">Add Azure key</a>
        )}

        <div className="flex-1" />

        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`text-sm font-semibold disabled:opacity-40 transition-colors ${
            savedBriefly ? 'text-[var(--muted)]' : 'text-[var(--primary)]'
          }`}
        >
          {saving ? 'Saving…' : savedBriefly ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SegmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const talk     = useQuery(api.talks.get,         { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');
  const saveSegmentElements = useMutation(api.talks.saveSegmentElements);

  const provider = settings?.provider ?? 'elevenlabs';
  const isAzure  = provider === 'azure';

  const ttsConfig: TTSConfig | null =
    settings && isAzure && settings.azureSubscriptionKey && settings.azureRegion
      ? { provider: 'azure', subscriptionKey: settings.azureSubscriptionKey, region: settings.azureRegion, voiceId: settings.voiceId }
      : null;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSave = useCallback(
    async (segmentId: string, elements: SegmentElement[]) => {
      if (!clerkId) return;
      await saveSegmentElements({ id: id as Id<'talks'>, userId: clerkId, segmentId, elements });
    },
    [id, clerkId, saveSegmentElements]
  );

  if (talk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border)] shrink-0">
        <a href={`/talk/${id}/edit`} className="text-sm text-[var(--muted)]">← Edit</a>
        <span className="text-sm font-semibold">Segments</span>
        <div className="w-12" />
      </header>

      {!isAzure ? (
        <div className="mx-4 mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5">
          <p className="text-sm font-medium mb-1">Azure TTS required</p>
          <p className="text-xs text-[var(--muted)]">
            The brick editor uses SSML and requires Azure TTS. Switch your provider in{' '}
            <a href="/settings" className="text-[var(--primary)]">Settings</a>.
          </p>
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-xs text-[var(--muted)] px-1">
            Pick a mode, then tap the first word in the range.
          </p>

          {talk!.segments.filter(seg => !expandedId || seg.id === expandedId).map((seg) => {
            const isExpanded = expandedId === seg.id;
            const dots = effectDots(seg.elements as SegmentElement[] | undefined);
            const initialAnnotations: WordAnnotation[] = seg.elements?.length
              ? buildAnnotations(seg.elements as SegmentElement[])
              : tokenise(seg.text);

            return (
              <div
                key={seg.id}
                className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : seg.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left"
                >
                  <p className="text-sm text-[var(--foreground)] line-clamp-2 flex-1">
                    {seg.text}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {dots.length > 0 && (
                      <span className="flex items-center gap-1">
                        {dots.map((d, i) => (
                          <span key={i} className={`w-2 h-2 rounded-full ${d.color}`} />
                        ))}
                      </span>
                    )}
                    <span className="text-[var(--muted)] text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Editor */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)]">
                    <SegmentBrickEditor
                      key={seg.id}
                      segmentId={seg.id}
                      initialAnnotations={initialAnnotations}
                      ttsConfig={ttsConfig}
                      onSave={handleSave}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </main>
      )}
    </div>
  );
}
