'use client';

import { use, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { SegmentsEditorPage } from '@/components/segments/SegmentsEditorPage';
import { OfflineGate } from '@/components/offline/OfflineGate';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useOnlineCurrentUser } from '@/hooks/useOnlineCurrentUser';
import { invalidateTalkOfflineState } from '@/lib/offlineTalkMaintenance';
import { SegmentElement } from '@/lib/ssml';
import { TTSConfig } from '@/lib/tts';

export default function SegmentsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <OfflineGate
      unavailableTitle="Segments unavailable offline"
      unavailableMessage="The segment editor is not available in Podium's offline emergency mode."
    >
      <OnlineSegmentsPage params={params} />
    </OfflineGate>
  );
}

function OnlineSegmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { clerkId } = useOnlineCurrentUser();

  const talk = useQuery(api.talks.get, { id: id as Id<'talks'> });
  const settings = useQuery(api.users.getSettings, clerkId ? { clerkId } : 'skip');
  const saveSegmentElements = useMutation(api.talks.saveSegmentElements);

  const provider = settings?.provider ?? 'elevenlabs';
  const isAzure = provider === 'azure';

  const ttsConfig: TTSConfig | null =
    settings && isAzure && settings.azureSubscriptionKey && settings.azureRegion
      ? {
          provider: 'azure',
          subscriptionKey: settings.azureSubscriptionKey,
          region: settings.azureRegion,
          voiceId: settings.voiceId,
        }
      : null;

  const handleSave = useCallback(
    async (segmentId: string, elements: SegmentElement[]) => {
      if (!clerkId) return;

      await saveSegmentElements({ id: id as Id<'talks'>, userId: clerkId, segmentId, elements });

      if (!talk) return;

      await invalidateTalkOfflineState({
        userId: clerkId,
        talkId: id,
        title: talk.title,
        segments: talk.segments.map((segment) => (
          segment.id === segmentId ? { ...segment, elements } : segment
        )),
      });
    },
    [clerkId, id, saveSegmentElements, talk]
  );

  if (talk === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </div>
    );
  }

  if (talk === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <p className="text-sm text-[var(--muted)]">Talk not found.</p>
      </div>
    );
  }

  return (
    <SegmentsEditorPage
      isAzure={isAzure}
      onSave={handleSave}
      segments={talk.segments.map((segment) => ({
        ...segment,
        elements: segment.elements as SegmentElement[] | undefined,
      }))}
      talkId={id}
      ttsConfig={ttsConfig}
    />
  );
}
