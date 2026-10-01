'use client';

import { useEffect, useRef } from 'react';

interface UnsavedChangesBarProps {
  saving?: boolean;
  onKeepEditing: () => void;
  onSaveAndLeave: () => void;
  onDiscard: () => void;
}

const buttonBase = 'min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50';

/**
 * Shown in place of a header when leaving with unsaved changes. The choices sit
 * where Back was, with Keep editing in Back's exact spot so an accidental double
 * tap is harmless. Inline rather than a modal, which is easier to reach with
 * switches and screen readers.
 */
export function UnsavedChangesBar({ saving = false, onKeepEditing, onSaveAndLeave, onDiscard }: UnsavedChangesBarProps) {
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  // Move focus to the choices so keyboard, switch and screen-reader users land on them.
  useEffect(() => {
    keepEditingRef.current?.focus();
  }, []);

  return (
    <header
      role="group"
      aria-labelledby="unsaved-changes-title"
      className="shrink-0 border-b border-[var(--border)] px-5 pt-5 pb-4"
    >
      <p id="unsaved-changes-title" className="pb-3 text-sm font-semibold text-[var(--foreground)]">
        You have unsaved changes
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          ref={keepEditingRef}
          type="button"
          onClick={onKeepEditing}
          className={`${buttonBase} border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]`}
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={onSaveAndLeave}
          disabled={saving}
          className={`${buttonBase} bg-[var(--primary)] text-white`}
        >
          {saving ? 'Saving…' : 'Save and leave'}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving}
          className={`${buttonBase} border border-red-400/60 text-red-400`}
        >
          Discard
        </button>
      </div>
    </header>
  );
}
