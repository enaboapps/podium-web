'use client';

import { use, useState, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { SegmentElement, buildSSML, tokenise } from '@/lib/ssml';
import { fetchTTSBlob, TTSConfig } from '@/lib/tts';

const AZURE_PALETTE: { group: string; items: { label: string; el: SegmentElement }[] }[] = [
  {
    group: 'Emphasis',
    items: [
      { label: 'begin emphasis', el: { type: 'emphasis-open' } },
      { label: 'end emphasis', el: { type: 'emphasis-close' } },
    ],
  },
  {
    group: 'Pace',
    items: [
      { label: 'slow', el: { type: 'prosody-open', rate: 0.75 } },
      { label: 'fast', el: { type: 'prosody-open', rate: 1.5 } },
      { label: 'end pace', el: { type: 'prosody-close' } },
    ],
  },
  {
    group: 'Pause',
    items: [
      { label: 'short pause', el: { type: 'break', ms: 250 } },
      { label: 'pause', el: { type: 'break', ms: 500 } },
      { label: 'long pause', el: { type: 'break', ms: 1000 } },
      { label: 'dramatic pause', el: { type: 'break', ms: 1500 } },
    ],
  },
];

function elementId(el: SegmentElement, idx: number): string {
  return `el-${idx}-${el.type}`;
}

function elementLabel(el: SegmentElement): string {
  if (el.type === 'word') return el.text;
  if (el.type === 'tag') return `[${el.value}]`;
  if (el.type === 'emphasis-open') return '[emphasis]';
  if (el.type === 'emphasis-close') return '◀ emphasis';
  if (el.type === 'prosody-open') return el.rate < 1 ? '[slow]' : '[fast]';
  if (el.type === 'prosody-close') return '◀ pace';
  if (el.type === 'break') {
    if (el.ms <= 300) return '[short pause]';
    if (el.ms <= 750) return '[pause]';
    if (el.ms <= 1250) return '[long pause]';
    return '[dramatic pause]';
  }
  return '';
}

function elementStyle(el: SegmentElement): string {
  const base = 'px-2 py-1 rounded-lg text-xs font-medium select-none cursor-grab active:cursor-grabbing';
  if (el.type === 'word') return `${base} bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]`;
  if (el.type === 'break') return `${base} bg-purple-900/40 border border-purple-600/50 text-purple-300`;
  return `${base} bg-teal-900/40 border border-teal-600/50 text-teal-300`;
}

function SortableBrick({ id, el }: { id: string; el: SegmentElement }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={elementStyle(el)}
    >
      {elementLabel(el)}
    </div>
  );
}

function SegmentBrickEditor({
  segmentId,
  initialElements,
  ttsConfig,
  onSave,
}: {
  segmentId: string;
  initialElements: SegmentElement[];
  ttsConfig: TTSConfig | null;
  onSave: (segmentId: string, elements: SegmentElement[]) => Promise<void>;
}) {
  const [elements, setElements] = useState<SegmentElement[]>(initialElements);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  const ids = elements.map((el, i) => elementId(el, i));
  const activeEl = activeId ? elements[ids.indexOf(activeId)] : null;

  const hasConsecutiveTags = elements.some(
    (el, i) => i > 0 && el.type !== 'word' && elements[i - 1].type !== 'word'
  );
  const validationErrors: string[] = [];
  if (hasConsecutiveTags) validationErrors.push('Tags must have a word between them');
  const isValid = validationErrors.length === 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    setElements((els) => arrayMove(els, oldIdx, newIdx));
    setSaved(false);
  }

  function addEl(el: SegmentElement) {
    setElements((els) => [...els, el]);
    setSaved(false);
  }

  function removeBrick(idx: number) {
    setElements((els) => els.filter((_, i) => i !== idx));
    setSaved(false);
  }

  async function handleTest() {
    if (!ttsConfig || testing) return;
    setTesting(true);
    try {
      const ssml = buildSSML(elements);
      const blob = await fetchTTSBlob(ssml, ttsConfig);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setTesting(false); };
      audio.onerror = () => setTesting(false);
      await audio.play();
    } catch {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(segmentId, elements);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Brick canvas */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-1.5 min-h-10 p-3 bg-[var(--background)] rounded-xl border border-[var(--border)]">
            {elements.map((el, i) => (
              <div key={ids[i]} className="relative group">
                <SortableBrick id={ids[i]} el={el} />
                {el.type !== 'word' && (
                  <button
                    onClick={() => removeBrick(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--border)] text-[var(--muted)] text-[9px] hidden group-hover:flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeEl && (
            <div className={`${elementStyle(activeEl)} shadow-lg`}>{elementLabel(activeEl)}</div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Tag palette */}
      <div className="space-y-2">
        {AZURE_PALETTE.map(({ group, items }) => (
          <div key={group}>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide mb-1">{group}</p>
            <div className="flex flex-wrap gap-1.5">
              {items.map(({ label, el }) => (
                <button
                  key={label}
                  onClick={() => addEl(el)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="space-y-0.5">
          {validationErrors.map((err) => (
            <p key={err} className="text-xs text-red-400">{err}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleTest}
          disabled={!ttsConfig || testing || !isValid}
          className="text-xs font-semibold text-[var(--muted)] disabled:opacity-40"
        >
          {testing ? 'Playing…' : '▶ Test'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || saved || !isValid}
          className="text-xs font-semibold text-[var(--primary)] disabled:opacity-40"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function SegmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');
  const saveSegmentElements = useMutation(api.talks.saveSegmentElements);

  const provider = settings?.provider ?? 'elevenlabs';
  const isAzure = provider === 'azure';

  const ttsConfig: TTSConfig | null = settings
    ? isAzure
      ? settings.azureSubscriptionKey && settings.azureRegion
        ? { provider: 'azure', subscriptionKey: settings.azureSubscriptionKey, region: settings.azureRegion, voiceId: settings.voiceId }
        : null
      : null
    : null;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSave = useCallback(
    async (segmentId: string, elements: SegmentElement[]) => {
      if (!clerkId) return;
      await saveSegmentElements({
        id: id as Id<'talks'>,
        userId: clerkId,
        segmentId,
        elements,
      });
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

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!isAzure ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5">
            <p className="text-sm font-medium text-[var(--foreground)] mb-1">Azure TTS required</p>
            <p className="text-xs text-[var(--muted)]">
              The brick editor uses SSML and requires Azure TTS. Switch your provider in{' '}
              <a href="/settings" className="text-[var(--primary)]">Settings</a>.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-[var(--muted)] px-1">
              Tap a segment to edit its bricks. Drag tag bricks to reposition them between words.
            </p>

            {talk!.segments.map((seg) => {
              const isExpanded = expandedId === seg.id;
              const initialElements: SegmentElement[] =
                (seg.elements as SegmentElement[] | undefined) ?? tokenise(seg.text);

              return (
                <div
                  key={seg.id}
                  className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : seg.id)}
                    className="w-full flex items-center justify-between px-4 py-4 text-left"
                  >
                    <p className="text-sm text-[var(--foreground)] line-clamp-2 flex-1 mr-3">
                      {seg.text}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {seg.elements && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)]">
                          edited
                        </span>
                      )}
                      <span className="text-[var(--muted)] text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[var(--border)] px-4 py-4">
                      <SegmentBrickEditor
                        key={seg.id}
                        segmentId={seg.id}
                        initialElements={initialElements}
                        ttsConfig={ttsConfig}
                        onSave={handleSave}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
