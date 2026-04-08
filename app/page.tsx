'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.replace('/library');
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
      <p className="text-sm text-[var(--muted)]">Opening library...</p>
    </div>
  );
}
