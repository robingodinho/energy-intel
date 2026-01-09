'use client';

import { useState, useEffect } from 'react';
import { EnervaBrand } from '@/components/EnervaBrand';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'logo' | 'text' | 'slogan' | 'fadeout'>('logo');

  useEffect(() => {
    // Phase timing
    const timers = [
      setTimeout(() => setPhase('text'), 600),      // Show text after 600ms
      setTimeout(() => setPhase('slogan'), 1200),   // Show slogan after 1.2s
      setTimeout(() => setPhase('fadeout'), 2800),  // Start fadeout at 2.8s
      setTimeout(() => onComplete(), 3800),         // Complete at 3.8s
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-center
                  transition-opacity duration-1000 ease-out
                  ${phase === 'fadeout' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >

      {/* Brand Name */}
      <div 
        className={`transition-all duration-700 ease-out mb-6
                    ${phase === 'logo' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
        style={{ transitionDelay: '100ms' }}
      >
        <EnervaBrand 
          size="large" 
          animate={phase === 'slogan' || phase === 'fadeout'} 
          glow 
        />
      </div>

      {/* Slogan with shine effect */}
      <p 
        className={`text-lg sm:text-xl font-light tracking-wide text-center max-w-md px-4
                    transition-all duration-700 ease-out
                    ${phase === 'logo' || phase === 'text' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
                    ${phase === 'slogan' || phase === 'fadeout' ? 'text-shine' : 'text-zinc-400'}`}
        style={{ transitionDelay: '200ms' }}
      >
        AI-Driven Intelligence for Energy Professionals
      </p>

      {/* Subtle animated line */}
      <div 
        className={`mt-8 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent
                    transition-all duration-1000 ease-out
                    ${phase === 'slogan' || phase === 'fadeout' ? 'w-48 opacity-100' : 'w-0 opacity-0'}`}
      />
    </div>
  );
}
