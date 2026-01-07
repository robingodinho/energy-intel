'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArticleCategory } from '@/types/article';
import { TimeRange } from '@/lib/getArticles';

const ARCHIVE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '24h', label: 'Past 24 hours' },
  { value: '7d', label: 'Past 7 days' },
  { value: '30d', label: 'Past month' },
  { value: '90d', label: 'Past 3 months' },
];

const TOPICS: { name: ArticleCategory; icon: React.ReactNode }[] = [
  { 
    name: 'LNG', 
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      </svg>
    )
  },
  { 
    name: 'Renewable Energy', 
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  { 
    name: 'Energy Policy', 
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  },
  { 
    name: 'Emissions', 
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    )
  },
  { 
    name: 'Infrastructure', 
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  },
];

/**
 * Category Filter with Latest tab, Topics dropdown, and Archive dropdown
 */
export function CategoryChips() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category') || null;
  const currentTimeRange = searchParams.get('archive') as TimeRange | null;
  const [isTopicsOpen, setIsTopicsOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const topicsRef = useRef<HTMLDivElement>(null);
  const archiveRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (topicsRef.current && !topicsRef.current.contains(event.target as Node)) {
        setIsTopicsOpen(false);
      }
      if (archiveRef.current && !archiveRef.current.contains(event.target as Node)) {
        setIsArchiveOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsTopicsOpen(false);
        setIsArchiveOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleLatestClick = () => {
    router.push('/');
    setIsTopicsOpen(false);
    setIsArchiveOpen(false);
  };

  const handleTopicClick = (category: ArticleCategory) => {
    router.push(`/?category=${encodeURIComponent(category)}`);
    setIsTopicsOpen(false);
  };

  const handleArchiveClick = (timeRange: TimeRange) => {
    const params = new URLSearchParams();
    params.set('archive', timeRange);
    if (currentCategory) {
      params.set('category', currentCategory);
    }
    router.push(`/?${params.toString()}`);
    setIsArchiveOpen(false);
  };

  const isLatestActive = !currentCategory && !currentTimeRange;
  const isArchiveActive = !!currentTimeRange;
  const selectedTopic = TOPICS.find(t => t.name === currentCategory);
  const selectedArchive = ARCHIVE_OPTIONS.find(a => a.value === currentTimeRange);

  return (
    <div className="flex items-center gap-2">
      {/* Latest Tab */}
      <button
        onClick={handleLatestClick}
        className={`
          px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-200
          ${isLatestActive 
            ? 'bg-cyan-500 text-zinc-900 shadow-lg shadow-cyan-500/25' 
            : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/50'
          }
        `}
      >
        Latest
      </button>

      {/* Topics Dropdown */}
      <div className="relative" ref={topicsRef}>
        <button
          onClick={() => { setIsTopicsOpen(!isTopicsOpen); setIsArchiveOpen(false); }}
          className={`
            flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-200
            ${currentCategory && !currentTimeRange
              ? 'bg-cyan-500 text-zinc-900 shadow-lg shadow-cyan-500/25' 
              : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/50'
            }
          `}
        >
          <span>{currentCategory || 'Topics'}</span>
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isTopicsOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Topics Dropdown Menu */}
        <div className={`absolute left-0 top-full mt-2 w-56 rounded-xl overflow-hidden
                         bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/30
                         transition-all duration-200 origin-top-left z-50
                         ${isTopicsOpen 
                           ? 'opacity-100 scale-100 translate-y-0' 
                           : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}
        >
          <nav className="py-2">
            {TOPICS.map((topic) => {
              const isActive = currentCategory === topic.name;
              return (
                <button
                  key={topic.name}
                  onClick={() => handleTopicClick(topic.name)}
                  className={`
                    flex items-center gap-3 w-full px-4 py-3 text-sm text-left
                    transition-colors duration-200
                    ${isActive 
                      ? 'bg-cyan-500/10 text-cyan-400' 
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-cyan-400'
                    }
                  `}
                >
                  <span className={isActive ? 'text-cyan-400' : 'text-zinc-500'}>
                    {topic.icon}
                  </span>
                  {topic.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Archive Dropdown */}
      <div className="relative" ref={archiveRef}>
        <button
          onClick={() => { setIsArchiveOpen(!isArchiveOpen); setIsTopicsOpen(false); }}
          className={`
            flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-200
            ${isArchiveActive
              ? 'bg-cyan-500 text-zinc-900 shadow-lg shadow-cyan-500/25' 
              : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/50'
            }
          `}
        >
          <span>{selectedArchive?.label || 'Archive'}</span>
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isArchiveOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Archive Dropdown Menu */}
        <div className={`absolute left-0 top-full mt-2 w-48 rounded-xl overflow-hidden
                         bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/30
                         transition-all duration-200 origin-top-left z-50
                         ${isArchiveOpen 
                           ? 'opacity-100 scale-100 translate-y-0' 
                           : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}
        >
          <nav className="py-2">
            {ARCHIVE_OPTIONS.map((option) => {
              const isActive = currentTimeRange === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleArchiveClick(option.value)}
                  className={`
                    w-full px-4 py-3 text-sm text-left
                    transition-colors duration-200
                    ${isActive 
                      ? 'bg-cyan-500/10 text-cyan-400' 
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-cyan-400'
                    }
                  `}
                >
                  {option.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
