// sessionStorage-backed persistence for the current segment index of a talk.
//
// This is a safety net against component remounts (hard refresh, accidental
// navigation, etc.) so the user's position survives. Scoped to the tab via
// sessionStorage — opening the same talk in a new tab intentionally starts
// at segment 0.

const keyFor = (talkId: string) => `podium:talk:index:${talkId}`;

export function readTalkIndex(talkId: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(keyFor(talkId));
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
  } catch {
    return null;
  }
}

export function writeTalkIndex(talkId: string, index: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(keyFor(talkId), String(index));
  } catch {
    // Storage may throw in private mode or when full — best-effort persistence.
  }
}
