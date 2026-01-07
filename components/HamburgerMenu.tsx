'use client';

import { useState, useRef, useEffect } from 'react';

export function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-col justify-center items-center w-10 h-10 rounded-lg 
                   bg-zinc-800/50 hover:bg-zinc-700 transition-all duration-200 group"
        aria-label="Menu"
        aria-expanded={isOpen}
      >
        <span className={`block w-5 h-0.5 bg-zinc-400 group-hover:bg-zinc-100 transition-all duration-300 
                         ${isOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
        <span className={`block w-5 h-0.5 bg-zinc-400 group-hover:bg-zinc-100 transition-all duration-300 mt-1
                         ${isOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-zinc-400 group-hover:bg-zinc-100 transition-all duration-300 mt-1
                         ${isOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden
                       bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/30
                       transition-all duration-200 origin-top-right
                       ${isOpen 
                         ? 'opacity-100 scale-100 translate-y-0' 
                         : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}
      >
        <nav className="py-2">
          <a
            href="/"
            className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 
                       hover:bg-zinc-800 hover:text-cyan-400 transition-colors duration-200"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Discover
          </a>
          <a
            href="/finance"
            className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 
                       hover:bg-zinc-800 hover:text-cyan-400 transition-colors duration-200"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M3 3v18h18M9 17V9m4 8v-5m4 5v-8" />
            </svg>
            Finance
          </a>
          <a
            href="/about"
            className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 
                       hover:bg-zinc-800 hover:text-cyan-400 transition-colors duration-200"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            About
          </a>
        </nav>
      </div>
    </div>
  );
}
