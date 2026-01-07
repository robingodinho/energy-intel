'use client';

import { useState, useEffect } from 'react';
import { SplashScreen } from './SplashScreen';

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const [showSplash, setShowSplash] = useState(true);
  const [hasSeenSplash, setHasSeenSplash] = useState(false);

  // Check if user has already seen splash this session
  useEffect(() => {
    const seen = sessionStorage.getItem('energy-intel-splash-seen');
    if (seen) {
      setShowSplash(false);
      setHasSeenSplash(true);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    setHasSeenSplash(true);
    sessionStorage.setItem('energy-intel-splash-seen', 'true');
  };

  return (
    <>
      {showSplash && !hasSeenSplash && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      <div 
        className={`transition-opacity duration-500 ease-out
                    ${showSplash && !hasSeenSplash ? 'opacity-0' : 'opacity-100'}`}
      >
        {children}
      </div>
    </>
  );
}

