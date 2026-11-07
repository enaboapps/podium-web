import { expect, it, vi } from 'vitest';
import { saveSectionSlide, restoreVersion, saveSegmentDelivery } from './talks';
import type { Doc } from './_generated/dataModel';

vi.mock('./_generated/server', () => ({
  mutation: (definition: unknown) => definition,
  query: (definition: unknown) => definition,
}));

const slide = { id: 'shared', title: 'Before' };
function context(subject: string | null = 'owner') {
  const talk = { _id: 'talk', userId: 'owner', title: 'Talk', fullText: 'Hello', segments: [{ id: 'one', text: 'Hello', slide }, { id: 'two', text: 'Again', slide }] };
  return {
    talk,
    auth: { getUserIdentity: vi.fn().mockResolvedValue(subject ? { subject } : null) },
    db: { get: vi.fn().mockResolvedValue(talk), patch: vi.fn(), insert: vi.fn() },
  };
}
type Context = ReturnType<typeof context>;
function invoke<Args>(mutation: unknown, ctx: Context, args: Args) {
  return (mutation as { handler: (ctx: Context, args: Args) => Promise<unknown> }).handler(ctx, args);
}

it('snapshots slides and updates all shared occurrences using the authenticated owner', async () => {
  const ctx = context();
  const next = { ...slide, title: 'After' };
  await invoke(saveSectionSlide, ctx, { id: 'talk', segmentId: 'one', slide: next });
  expect(ctx.db.insert).toHaveBeenCalledWith('talkVersions', expect.objectContaining({ segments: ctx.talk.segments }));
  expect(ctx.db.patch).toHaveBeenCalledWith('talk', { segments: ctx.talk.segments.map((s) => ({ ...s, slide: next })) });
});

it.each([null, 'other'])('rejects unauthorized slide edits: %s', async (subject) => {
  const ctx = context(subject);
  await expect(invoke(saveSectionSlide, ctx, { id: 'talk', segmentId: 'one', slide: null })).rejects.toThrow('Not found');
  expect(ctx.db.patch).not.toHaveBeenCalled();
  expect(ctx.db.insert).not.toHaveBeenCalled();
});

it('preserves slides when changing delivery settings', async () => {
  const ctx = context();
  await invoke(saveSegmentDelivery, ctx, { id: 'talk', userId: 'owner', segmentId: 'one', words: [{ text: 'Hello', stress: true }], mood: 'warm' });
  const segments = ctx.db.patch.mock.calls[0][1].segments as Doc<'talks'>['segments'];
  expect(segments[0].slide).toEqual(slide);
  expect(segments[1].slide).toEqual(slide);
  expect(segments[0].mood).toBe('warm');
});

it.each([true, false])('restores versions with or without slides: %s', async (hasSlides) => {
  const ctx = context();
  const segments = [{ id: 'old', text: 'Old', ...(hasSlides ? { slide } : {}) }];
  ctx.db.get.mockResolvedValueOnce(ctx.talk).mockResolvedValueOnce({ talkId: 'talk', segments });
  await invoke(restoreVersion, ctx, { talkId: 'talk', versionId: 'version', userId: 'owner' });
  expect(ctx.db.insert).toHaveBeenCalledWith('talkVersions', expect.objectContaining({ segments: ctx.talk.segments }));
  expect(ctx.db.patch).toHaveBeenCalledWith('talk', expect.objectContaining({ segments }));
});
