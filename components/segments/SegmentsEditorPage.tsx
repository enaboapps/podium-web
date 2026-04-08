'use client';

import { useState } from 'react';
import { getEffectDots } from '@/lib/segmentEditorStyles';
import { SegmentElement, WordAnnotation, buildAnnotations, tokenise } from '@/lib/ssml';
import { TTSConfig } from '@/lib/tts';
import { SegmentBrickEditor } from './SegmentBrickEditor';

interface SegmentRecord {
  id: string;
  text: string;
  elements?: SegmentElement[];
}

interface SegmentsEditorPageProps {
  isAzure: boolean;
  onSave: (segmentId: string, elements: SegmentElement[]) => Promise<void>;
  segments: SegmentRecord[];
  talkId: string;
  ttsConfig: TTSConfig | null;
}

export function SegmentsEditorPage({
  isAzure,
  onSave,
  segments,
  talkId,
  ttsConfig,
}: SegmentsEditorPageProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 pb-4 pt-6">
        <a href={`/talk/${talkId}/edit`} className="text-sm text-[var(--muted)]">
          &lt;- Edit
        </a>
        <span className="text-sm font-semibold">Segments</span>
        <div className="w-12" />
      </header>

      {!isAzure ? (
        <div className="mx-4 mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5">
          <p className="mb-1 text-sm font-medium">Azure TTS required</p>
          <p className="text-xs text-[var(--muted)]">
            The brick editor uses SSML and requires Azure TTS. Switch your provider in{' '}
            <a href="/settings" className="text-[var(--primary)]">
              Settings
            </a>
            .
          </p>
        </div>
      ) : (
        <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p className="px-1 text-xs text-[var(--muted)]">
            Pick a mode, then tap the first word in the range.
          </p>

          {segments.filter((segment) => !expandedId || segment.id === expandedId).map((segment) => {
            const isExpanded = expandedId === segment.id;
            const dots = getEffectDots(segment.elements);
            const initialAnnotations: WordAnnotation[] = segment.elements?.length
              ? buildAnnotations(segment.elements)
              : tokenise(segment.text);

            return (
              <div
                key={segment.id}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : segment.id)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left"
                >
                  <p className="line-clamp-2 flex-1 text-sm text-[var(--foreground)]">
                    {segment.text}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {dots.length > 0 ? (
                      <span className="flex items-center gap-1">
                        {dots.map((dot, index) => (
                          <span key={index} className={`h-2 w-2 rounded-full ${dot.color}`} />
                        ))}
                      </span>
                    ) : null}
                    <span className="text-xs text-[var(--muted)]">
                      {isExpanded ? '[up]' : '[down]'}
                    </span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-[var(--border)]">
                    <SegmentBrickEditor
                      key={segment.id}
                      initialAnnotations={initialAnnotations}
                      onSave={onSave}
                      segmentId={segment.id}
                      ttsConfig={ttsConfig}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </main>
      )}
    </div>
  );
}
