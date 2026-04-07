'use client';

import { use, useState, useCallback, useRef, useMemo } from 'react';
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function pauseLabel(ms: number): string {
  if (ms <= 300) return '¼s';
  if (ms <= 750) return '½s';
  if (ms <= 1250) return '1s';
  return '2s';
}

type EffectState = 'on' | 'mixed' | 'off';

function effectState(annotations: WordAnnotation[], ids: Set<string>, key: 'emphasis'): EffectState;
function effectState(annotations: WordAnnotation[], ids: Set<string>, key: 'slow' | 'fast'): EffectState;
function effectState(annotations: WordAnnotation[], ids: Set<string>, key: 'emphasis' | 'slow' | 'fast'): EffectState {
  const sel = annotations.filter(a => ids.has(a.id));
  if (sel.length === 0) return 'off';
  const has = (a: WordAnnotation) =>
    key === 'emphasis' ? a.emphasis :
    key === 'slow'     ? (a.rate !== null && a.rate < 1) :
                         (a.rate !== null && a.rate >= 1);
  if (sel.every(has)) return 'on';
  if (sel.some(has))  return 'mixed';
  return 'off';
}

function wordChipClass(ann: WordAnnotation, selected: boolean): string {
  const base = 'min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium leading-tight transition-colors select-none';
  if (selected) return `${base} bg-indigo-600 text-white`;
  const { emphasis, rate, sayAs } = ann;
  const slow = rate !== null && rate < 1;
  const fast = rate !== null && rate >= 1;
  if (emphasis && slow) return `${base} bg-amber-900/40 border border-amber-500/60 text-amber-200 font-semibold underline underline-offset-2 decoration-blue-400/60`;
  if (emphasis && fast) return `${base} bg-amber-900/40 border border-amber-500/60 text-amber-200 font-semibold italic`;
  if (emphasis)  return `${base} bg-amber-900/40 border border-amber-500/60 text-amber-200 font-semibold`;
  if (slow)      return `${base} bg-blue-900/40 border border-blue-500/60 text-blue-200 underline underline-offset-2 decoration-blue-400/60`;
  if (fast)      return `${base} bg-orange-900/40 border border-orange-500/60 text-orange-200 italic`;
  if (sayAs)     return `${base} bg-teal-900/40 border border-teal-500/60 text-teal-200 tracking-widest`;
  return `${base} bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]`;
}

function effectDots(elements: SegmentElement[] | undefined) {
  if (!elements?.length) return [];
  return [
    { show: elements.some(e => e.type === 'emphasis-open'),                                    color: 'bg-amber-500' },
    { show: elements.some(e => e.type === 'prosody-open' && e.rate < 1),                       color: 'bg-blue-500' },
    { show: elements.some(e => e.type === 'prosody-open' && e.rate >= 1),                      color: 'bg-orange-500' },
    { show: elements.some(e => e.type === 'say-as'),                                           color: 'bg-teal-500' },
    { show: elements.some(e => e.type === 'break'),                                            color: 'bg-purple-500' },
  ].filter(d => d.show);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-xs text-[var(--muted)] border-b border-[var(--border)]">
      {[
        { color: 'bg-amber-500',  label: 'Emphasise' },
        { color: 'bg-blue-500',   label: 'Slow' },
        { color: 'bg-orange-500', label: 'Fast' },
        { color: 'bg-teal-500',   label: 'Spell out' },
        { color: 'bg-purple-500', label: 'Pause' },
      ].map(({ color, label }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
          {label}
        </span>
      ))}
    </div>
  );
}

interface ToolbarProps {
  selectedCount: number;
  emphasisState: EffectState;
  slowState: EffectState;
  fastState: EffectState;
  sayAsOn: boolean;
  onEmphasis: () => void;
  onSlow: () => void;
  onFast: () => void;
  onPauseInsert: (ms: number) => void;
  onSpellOut: () => void;
  onClear: () => void;
  onDone: () => void;
}

function EffectToolbar({
  selectedCount, emphasisState, slowState, fastState, sayAsOn,
  onEmphasis, onSlow, onFast, onPauseInsert, onSpellOut, onClear, onDone,
}: ToolbarProps) {
  const [showPause, setShowPause] = useState(false);

  function btnClass(state: EffectState | boolean) {
    if (state === 'on' || state === true)
      return 'h-11 px-4 rounded-xl text-sm font-medium bg-[var(--primary)] text-white shrink-0';
    if (state === 'mixed')
      return 'h-11 px-4 rounded-xl text-sm font-medium border border-[var(--primary)] text-[var(--primary)] shrink-0';
    return 'h-11 px-4 rounded-xl text-sm font-medium bg-[var(--surface)] text-[var(--foreground)] shrink-0';
  }

  if (showPause) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--background)] border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
          {([
            { label: 'Short (¼s)', ms: 250 },
            { label: 'Medium (½s)', ms: 500 },
            { label: 'Long (1s)', ms: 1000 },
            { label: 'Dramatic (2s)', ms: 2000 },
          ] as const).map(({ label, ms }) => (
            <button
              key={ms}
              onClick={() => { onPauseInsert(ms); setShowPause(false); }}
              className="h-11 px-4 rounded-xl text-sm font-medium bg-[var(--surface)] text-[var(--foreground)] whitespace-nowrap shrink-0"
            >
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setShowPause(false)} className="h-11 px-4 text-sm text-[var(--muted)] shrink-0">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--background)] border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
        <button onClick={onEmphasis}              className={btnClass(emphasisState)}>Emphasise</button>
        <button onClick={onSlow}                  className={btnClass(slowState)}>Slow</button>
        <button onClick={onFast}                  className={btnClass(fastState)}>Fast</button>
        <button onClick={() => setShowPause(true)} className="h-11 px-4 rounded-xl text-sm font-medium bg-[var(--surface)] text-[var(--foreground)] shrink-0">+ Pause</button>
        {selectedCount === 1 && (
          <button onClick={onSpellOut} className={btnClass(sayAsOn)}>Spell out</button>
        )}
        <button onClick={onClear} className="h-11 px-4 rounded-xl text-sm font-medium bg-[var(--surface)] text-[var(--muted)] shrink-0">Clear</button>
        <div className="flex-1 shrink-0 min-w-2" />
        <button onClick={onDone} className="h-11 px-4 rounded-xl text-sm font-medium bg-[var(--surface)] text-[var(--foreground)] shrink-0">Done</button>
      </div>
    </div>
  );
}

interface PauseSheetProps {
  ms: number;
  onSelect: (ms: number) => void;
  onRemove: () => void;
  onClose: () => void;
}

function PauseSheet({ ms, onSelect, onRemove, onClose }: PauseSheetProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--background)] border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
        <span className="text-xs text-[var(--muted)] shrink-0 mr-1">Pause:</span>
        {([
          { label: '¼s', ms: 250 },
          { label: '½s', ms: 500 },
          { label: '1s', ms: 1000 },
          { label: '2s', ms: 2000 },
        ] as const).map((opt) => (
          <button
            key={opt.ms}
            onClick={() => { onSelect(opt.ms); onClose(); }}
            className={`h-11 px-4 rounded-xl text-sm font-medium shrink-0 ${
              opt.ms === ms
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--surface)] text-[var(--foreground)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => { onRemove(); onClose(); }}
          className="h-11 px-4 rounded-xl text-sm font-medium bg-[var(--surface)] text-red-400 shrink-0"
        >
          Remove
        </button>
        <div className="flex-1" />
        <button onClick={onClose} className="h-11 px-4 text-sm text-[var(--muted)] shrink-0">✕</button>
      </div>
    </div>
  );
}

// ─── Brick Editor ────────────────────────────────────────────────────────────

interface EditorProps {
  segmentId: string;
  initialAnnotations: WordAnnotation[];
  ttsConfig: TTSConfig | null;
  onSave: (segmentId: string, elements: SegmentElement[]) => Promise<void>;
}

type PlayState = 'idle' | 'loading' | 'playing' | 'error';

function SegmentBrickEditor({ segmentId, initialAnnotations, ttsConfig, onSave }: EditorProps) {
  const [annotations, setAnnotations] = useState<WordAnnotation[]>(initialAnnotations);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pauseEditId, setPauseEditId] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [playError, setPlayError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedBriefly, setSavedBriefly] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selected = useMemo(() => annotations.filter(a => selectedIds.has(a.id)), [annotations, selectedIds]);
  const empState  = useMemo(() => effectState(annotations, selectedIds, 'emphasis'), [annotations, selectedIds]);
  const slowState = useMemo(() => effectState(annotations, selectedIds, 'slow'),     [annotations, selectedIds]);
  const fastState = useMemo(() => effectState(annotations, selectedIds, 'fast'),     [annotations, selectedIds]);
  const sayAsOn   = selected.length === 1 && selected[0].sayAs !== null;

  function toggleWord(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setPauseEditId(null);
  }

  function mutate(fn: (a: WordAnnotation) => WordAnnotation) {
    setAnnotations(prev => prev.map(a => selectedIds.has(a.id) ? fn(a) : a));
    setDirty(true);
    setSavedBriefly(false);
  }

  function applyEmphasis() {
    const allOn = empState === 'on';
    mutate(a => ({ ...a, emphasis: !allOn }));
  }

  function applySlow() {
    const allOn = slowState === 'on';
    mutate(a => ({ ...a, rate: allOn ? null : 0.7 }));
  }

  function applyFast() {
    const allOn = fastState === 'on';
    mutate(a => ({ ...a, rate: allOn ? null : 1.4 }));
  }

  function applySpellOut() {
    if (selected.length !== 1) return;
    const isOn = selected[0].sayAs !== null;
    mutate(a => ({ ...a, sayAs: isOn ? null : 'characters' }));
  }

  function clearEffects() {
    mutate(a => ({ ...a, emphasis: false, rate: null, sayAs: null }));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function insertPause(ms: number) {
    if (selected.length === 0) return;
    const lastSelectedId = [...selectedIds].at(-1) ?? selected[selected.length - 1].id;
    setAnnotations(prev => prev.map(a => {
      if (a.id !== lastSelectedId) return a;
      return { ...a, pauseAfterMs: ms }; // update if exists, insert if null
    }));
    setDirty(true);
    setSavedBriefly(false);
  }

  function editPause(id: string, ms: number) {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, pauseAfterMs: ms } : a));
    setDirty(true);
    setSavedBriefly(false);
  }

  function removePause(id: string) {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, pauseAfterMs: null } : a));
    setDirty(true);
    setSavedBriefly(false);
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
      const elements = buildElements(annotations);
      const ssml = buildSSML(elements);
      const blob = await fetchTTSBlob(ssml, ttsConfig);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setPlayState('idle'); };
      audio.onerror = () => { URL.revokeObjectURL(url); setPlayState('idle'); };
      setPlayState('playing');
      await audio.play();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const errText = msg.includes('401') ? 'Azure key invalid — check Settings'
        : msg.includes('429') ? 'Quota reached — try later'
        : 'Test failed — check connection';
      setPlayError(errText);
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
    } catch {
      // leave dirty so user can retry
    } finally {
      setSaving(false);
    }
  }

  const showToolbar = selectedIds.size > 0 && pauseEditId === null;
  const pauseEditAnnotation = pauseEditId ? annotations.find(a => a.id === pauseEditId) : null;

  return (
    <div className="flex flex-col">
      <Legend />

      {/* Word canvas */}
      <div className="flex flex-wrap gap-1.5 px-3 py-3 pb-14">
        {annotations.map((ann) => (
          <span key={ann.id} className="contents">
            <button
              onClick={() => toggleWord(ann.id)}
              className={wordChipClass(ann, selectedIds.has(ann.id))}
            >
              {ann.text}
            </button>
            {ann.pauseAfterMs !== null && (
              <button
                onClick={() => { deselectAll(); setPauseEditId(ann.id); }}
                className="flex flex-col items-center justify-center mx-0.5 shrink-0"
                style={{ minWidth: 32, minHeight: 44 }}
                aria-label={`Pause: ${ann.pauseAfterMs}ms`}
              >
                <div className="w-0.5 h-4 bg-purple-500/70 rounded-full" />
                <span className="text-[9px] text-purple-400 mt-0.5 leading-none">{pauseLabel(ann.pauseAfterMs)}</span>
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Footer bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--border)]">
        <button
          onClick={handleTest}
          disabled={!ttsConfig || playState === 'loading'}
          className={`text-sm font-medium disabled:opacity-40 transition-colors ${
            playState === 'playing' ? 'text-[var(--primary)]'
            : playState === 'error' ? 'text-red-400'
            : 'text-[var(--muted)]'
          }`}
        >
          {playState === 'loading' && 'Loading…'}
          {playState === 'playing' && '■ Stop'}
          {playState === 'error'   && (playError ?? 'Test failed')}
          {playState === 'idle'    && (ttsConfig ? '▶ Test' : '▶ Test')}
        </button>

        {!ttsConfig && (
          <span className="text-xs text-[var(--muted)]">
            <a href="/settings" className="text-[var(--primary)]">Add Azure key</a> to test
          </span>
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

      {/* Effect toolbar (fixed bottom) */}
      {showToolbar && (
        <EffectToolbar
          selectedCount={selectedIds.size}
          emphasisState={empState}
          slowState={slowState}
          fastState={fastState}
          sayAsOn={sayAsOn}
          onEmphasis={applyEmphasis}
          onSlow={applySlow}
          onFast={applyFast}
          onPauseInsert={insertPause}
          onSpellOut={applySpellOut}
          onClear={clearEffects}
          onDone={deselectAll}
        />
      )}

      {/* Pause edit sheet (fixed bottom) */}
      {pauseEditAnnotation && (
        <PauseSheet
          ms={pauseEditAnnotation.pauseAfterMs!}
          onSelect={(ms) => editPause(pauseEditAnnotation.id, ms)}
          onRemove={() => removePause(pauseEditAnnotation.id)}
          onClose={() => setPauseEditId(null)}
        />
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SegmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');
  const saveSegmentElements = useMutation(api.talks.saveSegmentElements);

  const provider = settings?.provider ?? 'elevenlabs';
  const isAzure = provider === 'azure';

  const ttsConfig: TTSConfig | null = settings && isAzure && settings.azureSubscriptionKey && settings.azureRegion
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

      {!isAzure && (
        <div className="mx-4 mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5">
          <p className="text-sm font-medium text-[var(--foreground)] mb-1">Azure TTS required</p>
          <p className="text-xs text-[var(--muted)]">
            The brick editor uses SSML and requires Azure TTS. Switch your provider in{' '}
            <a href="/settings" className="text-[var(--primary)]">Settings</a>.
          </p>
        </div>
      )}

      {isAzure && (
        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-xs text-[var(--muted)] px-1">
            Tap words to select them, then use the toolbar to apply effects.
          </p>

          {talk!.segments.map((seg) => {
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
                {/* Collapsed header */}
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

                {/* Expanded editor */}
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
