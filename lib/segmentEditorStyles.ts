import { SegmentElement, WordAnnotation } from '@/lib/ssml';

export type EditorMode =
  | 'emphasis'
  | 'dramatic'
  | 'whisper'
  | 'excited'
  | 'slow'
  | 'fast'
  | 'loud'
  | 'soft'
  | 'sayAs'
  | 'pause-250'
  | 'pause-500'
  | 'pause-1000'
  | 'pause-2000'
  | 'clear';

export type PlayState = 'idle' | 'loading' | 'playing' | 'error';

export interface ModeEffect {
  clear?: true;
  emphasis?: true;
  pauseMs?: number;
  pitch?: string;
  rate?: number;
  sayAs?: 'characters';
  volume?: string;
}

interface SegmentEditorModeConfig {
  effect: ModeEffect;
  key: EditorMode;
  label: string;
  off: string;
  on: string;
}

export const SEGMENT_EDITOR_MODES: SegmentEditorModeConfig[] = [
  {
    key: 'emphasis',
    label: 'Emphasise',
    off: 'border border-amber-800/40 bg-amber-900/20 text-amber-400',
    on: 'bg-amber-600 text-white',
    effect: { emphasis: true },
  },
  {
    key: 'dramatic',
    label: 'Dramatic',
    off: 'border border-indigo-800/40 bg-indigo-900/20 text-indigo-400',
    on: 'bg-indigo-600 text-white',
    effect: { rate: 0.75, pitch: '-10%' },
  },
  {
    key: 'whisper',
    label: 'Whisper',
    off: 'border border-slate-700/40 bg-slate-800/30 text-slate-400',
    on: 'bg-slate-600 text-white',
    effect: { rate: 0.8, volume: 'soft' },
  },
  {
    key: 'excited',
    label: 'Excited',
    off: 'border border-rose-800/40 bg-rose-900/20 text-rose-400',
    on: 'bg-rose-600 text-white',
    effect: { rate: 1.3, pitch: '+10%' },
  },
  {
    key: 'slow',
    label: 'Slow',
    off: 'border border-blue-800/40 bg-blue-900/20 text-blue-400',
    on: 'bg-blue-600 text-white',
    effect: { rate: 0.75 },
  },
  {
    key: 'fast',
    label: 'Fast',
    off: 'border border-orange-800/40 bg-orange-900/20 text-orange-400',
    on: 'bg-orange-500 text-white',
    effect: { rate: 1.3 },
  },
  {
    key: 'loud',
    label: 'Loud',
    off: 'border border-yellow-800/40 bg-yellow-900/20 text-yellow-400',
    on: 'bg-yellow-500 text-white',
    effect: { volume: '+6dB' },
  },
  {
    key: 'soft',
    label: 'Soft',
    off: 'border border-slate-700/40 bg-slate-800/30 text-slate-400',
    on: 'bg-slate-500 text-white',
    effect: { volume: 'soft' },
  },
  {
    key: 'sayAs',
    label: 'Spell out',
    off: 'border border-teal-800/40 bg-teal-900/20 text-teal-400',
    on: 'bg-teal-600 text-white',
    effect: { sayAs: 'characters' },
  },
  {
    key: 'pause-250',
    label: '1/4s',
    off: 'border border-purple-800/40 bg-purple-900/20 text-purple-400',
    on: 'bg-purple-600 text-white',
    effect: { pauseMs: 250 },
  },
  {
    key: 'pause-500',
    label: '1/2s',
    off: 'border border-purple-800/40 bg-purple-900/20 text-purple-400',
    on: 'bg-purple-600 text-white',
    effect: { pauseMs: 500 },
  },
  {
    key: 'pause-1000',
    label: '1s',
    off: 'border border-purple-800/40 bg-purple-900/20 text-purple-400',
    on: 'bg-purple-600 text-white',
    effect: { pauseMs: 1000 },
  },
  {
    key: 'pause-2000',
    label: '2s',
    off: 'border border-purple-800/40 bg-purple-900/20 text-purple-400',
    on: 'bg-purple-600 text-white',
    effect: { pauseMs: 2000 },
  },
  {
    key: 'clear',
    label: 'Clear',
    off: 'border border-transparent bg-[var(--surface)] text-[var(--muted)]',
    on: 'border border-red-600/40 bg-red-900/40 text-red-300',
    effect: { clear: true },
  },
];

export function getModeEffect(mode: EditorMode): ModeEffect {
  return SEGMENT_EDITOR_MODES.find((config) => config.key === mode)?.effect ?? {};
}

export function formatPauseLabel(ms: number) {
  if (ms <= 300) return '1/4s';
  if (ms <= 750) return '1/2s';
  if (ms <= 1250) return '1s';
  return '2s';
}

export function getWordChipClass(annotation: WordAnnotation, isInteractive: boolean): string {
  const base =
    'min-h-[44px] rounded-xl px-3 py-2 text-sm font-medium leading-tight transition-all active:scale-95';
  const ring = isInteractive
    ? ' ring-2 ring-white/30 ring-offset-1 ring-offset-[var(--background)]'
    : '';
  const { emphasis, pitch, rate, sayAs, volume } = annotation;

  const isSlow = rate !== null && rate < 1;
  const isFast = rate !== null && rate >= 1;
  const pitchNumber = pitch ? parseFloat(pitch) : Number.NaN;
  const isLoudVolume =
    volume !== null &&
    (volume === 'loud' || volume === 'x-loud' || (volume.startsWith('+') && volume.includes('dB')));
  const isSoftVolume = volume !== null && !isLoudVolume;
  const isDramatic = isSlow && !Number.isNaN(pitchNumber) && pitchNumber < 0;
  const isWhisper = isSlow && isSoftVolume;
  const isExcited = isFast && !Number.isNaN(pitchNumber) && pitchNumber > 0;

  if (emphasis && isSlow) {
    return `${base}${ring} border border-amber-500/60 bg-amber-900/40 font-semibold text-amber-200 underline decoration-blue-400/60 underline-offset-2`;
  }
  if (emphasis && isFast) {
    return `${base}${ring} border border-amber-500/60 bg-amber-900/40 font-semibold italic text-amber-200`;
  }
  if (emphasis) {
    return `${base}${ring} border border-amber-500/60 bg-amber-900/40 font-semibold text-amber-200`;
  }
  if (isDramatic) {
    return `${base}${ring} border border-indigo-500/60 bg-indigo-900/40 text-indigo-200`;
  }
  if (isWhisper) {
    return `${base}${ring} border border-slate-500/60 bg-slate-800/60 italic text-slate-300`;
  }
  if (isExcited) {
    return `${base}${ring} border border-rose-500/60 bg-rose-900/40 font-semibold text-rose-200`;
  }
  if (isSlow) {
    return `${base}${ring} border border-blue-500/60 bg-blue-900/40 text-blue-200 underline decoration-blue-400/60 underline-offset-2`;
  }
  if (isFast) {
    return `${base}${ring} border border-orange-500/60 bg-orange-900/40 italic text-orange-200`;
  }
  if (isLoudVolume) {
    return `${base}${ring} border border-yellow-500/60 bg-yellow-900/40 font-bold text-yellow-200`;
  }
  if (isSoftVolume) {
    return `${base}${ring} border border-slate-600/40 bg-slate-800/40 text-slate-400`;
  }
  if (sayAs) {
    return `${base}${ring} border border-teal-500/60 bg-teal-900/40 tracking-widest text-teal-200`;
  }
  return `${base}${ring} border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]`;
}

export function getEffectDots(elements: SegmentElement[] | undefined) {
  if (!elements?.length) return [];

  return [
    {
      show: elements.some((element) => element.type === 'emphasis-open'),
      color: 'bg-amber-500',
    },
    {
      show: elements.some(
        (element) => element.type === 'prosody-open' && element.rate !== undefined && element.rate < 1
      ),
      color: 'bg-blue-500',
    },
    {
      show: elements.some(
        (element) => element.type === 'prosody-open' && element.rate !== undefined && element.rate >= 1
      ),
      color: 'bg-orange-500',
    },
    {
      show: elements.some(
        (element) => element.type === 'prosody-open' && element.pitch !== undefined
      ),
      color: 'bg-indigo-500',
    },
    {
      show: elements.some(
        (element) => element.type === 'prosody-open' && element.volume !== undefined
      ),
      color: 'bg-yellow-500',
    },
    {
      show: elements.some((element) => element.type === 'say-as'),
      color: 'bg-teal-500',
    },
    {
      show: elements.some((element) => element.type === 'break'),
      color: 'bg-purple-500',
    },
  ].filter((dot) => dot.show);
}

export function applyModeEffect(annotation: WordAnnotation, effect: ModeEffect): WordAnnotation {
  if (effect.clear) {
    return {
      ...annotation,
      emphasis: false,
      rate: null,
      pitch: null,
      volume: null,
      sayAs: null,
      pauseAfterMs: null,
    };
  }

  return {
    ...annotation,
    ...(effect.emphasis !== undefined && { emphasis: effect.emphasis }),
    ...(effect.rate !== undefined && { rate: effect.rate }),
    ...(effect.pitch !== undefined && { pitch: effect.pitch }),
    ...(effect.volume !== undefined && { volume: effect.volume }),
    ...(effect.sayAs !== undefined && { sayAs: effect.sayAs }),
    ...(effect.pauseMs !== undefined && { pauseAfterMs: effect.pauseMs }),
  };
}
