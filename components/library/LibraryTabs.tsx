'use client';

import { LibraryTab } from './libraryTypes';

interface LibraryTabsProps {
  activeTab: LibraryTab;
  onTabChange: (tab: LibraryTab) => void;
}

export function LibraryTabs({ activeTab, onTabChange }: LibraryTabsProps) {
  return (
    <div className="flex border-b border-[var(--border)]">
      {(['talks', 'sets'] as LibraryTab[]).map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
            activeTab === tab
              ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]'
              : 'text-[var(--muted)]'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
