import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, X } from 'lucide-react';
import { CHANGELOG, ChangelogCategory, ChangelogEntry } from '../data/changelog';

const LAST_SEEN_STORAGE_KEY = 'guardian_whatsnew_last_seen_id';

interface WhatsNewDropdownProps {
  className?: string;
}

const categoryStyles: Record<
  ChangelogCategory,
  { label: string; className: string }
> = {
  new: {
    label: 'New',
    className: 'bg-secondary/10 text-secondary border border-secondary/20',
  },
  improved: {
    label: 'Improved',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  fixed: {
    label: 'Fixed',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
  },
};

const formatReleaseDate = (isoDate: string): string => {
  // Use midday UTC to avoid timezone rollover flipping the displayed day.
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getUnreadCount = (entries: ChangelogEntry[], lastSeenId: string | null): number => {
  if (entries.length === 0) {
    return 0;
  }
  if (!lastSeenId) {
    return entries.length;
  }
  const index = entries.findIndex((entry) => entry.id === lastSeenId);
  // If the stored id is no longer in the list, treat everything as unread.
  if (index === -1) {
    return entries.length;
  }
  return index;
};

const WhatsNewDropdown: React.FC<WhatsNewDropdownProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenId, setLastSeenId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LAST_SEEN_STORAGE_KEY);
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () => getUnreadCount(CHANGELOG, lastSeenId),
    [lastSeenId],
  );

  // Close on outside click.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggleDropdown = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && CHANGELOG.length > 0) {
      const newestId = CHANGELOG[0].id;
      if (newestId !== lastSeenId) {
        setLastSeenId(newestId);
        try {
          window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, newestId);
        } catch {
          // Ignore storage errors (private mode, quota, etc.) — badge will
          // just reappear next session.
        }
      }
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={handleToggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        aria-label="What's new"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Sparkles className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center min-w-5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-[28rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-[32rem] overflow-hidden animate-fade-in"
          role="menu"
        >
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" />
                <h3 className="text-lg font-semibold text-gray-900">What's New</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close what's new panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Recent updates and improvements to Guardian
            </p>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {CHANGELOG.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No updates yet — check back soon.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {CHANGELOG.map((entry, index) => {
                  const isUnread =
                    !lastSeenId ||
                    (CHANGELOG.findIndex((e) => e.id === lastSeenId) === -1
                      ? true
                      : index < CHANGELOG.findIndex((e) => e.id === lastSeenId));
                  return (
                    <li key={entry.id} className="p-4">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {formatReleaseDate(entry.date)}
                        </span>
                        {entry.version && (
                          <span className="text-xs text-gray-500">• {entry.version}</span>
                        )}
                        {isUnread && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-red-500 text-white rounded-full px-2 py-0.5">
                            New
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-semibold text-gray-900 mb-2">
                        {entry.title}
                      </h4>
                      <ul className="space-y-2">
                        {entry.highlights.map((highlight, highlightIndex) => {
                          const style = categoryStyles[highlight.category];
                          return (
                            <li
                              key={highlightIndex}
                              className="flex items-start gap-2 text-sm text-gray-700"
                            >
                              <span
                                className={`flex-shrink-0 mt-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${style.className}`}
                              >
                                {style.label}
                              </span>
                              <span className="flex-1 leading-snug">{highlight.text}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsNewDropdown;
