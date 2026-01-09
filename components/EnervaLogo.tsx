'use client';

interface EnervaLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  className?: string;
  color?: string;
}

/**
 * EnervaLogo Component
 * 
 * Renders the enerva logo mark - two slanted parallel bars
 * Pure SVG implementation for crisp rendering at any size
 * 
 * The design features two parallelogram bars slanted at approximately 18 degrees,
 * creating a dynamic, forward-moving visual identity.
 */
export function EnervaLogo({ size = 'medium', className = '', color }: EnervaLogoProps) {
  const sizeMap = {
    small: 'h-8 w-auto',
    medium: 'h-12 w-auto',
    large: 'h-16 w-auto',
    xlarge: 'h-24 w-auto',
  };

  // Parallelogram dimensions matching the brand logo
  // Slant angle: ~18 degrees (tan(18°) ≈ 0.325)
  const slant = 18; // horizontal offset for the slant
  const barWidth = 14;
  const gap = 12;
  
  // Left bar coordinates
  const leftBar = {
    topLeft: { x: 10 + slant, y: 5 },
    topRight: { x: 10 + slant + barWidth, y: 5 },
    bottomRight: { x: 10 + barWidth, y: 95 },
    bottomLeft: { x: 10, y: 95 },
  };
  
  // Right bar coordinates  
  const rightBar = {
    topLeft: { x: 10 + barWidth + gap + slant, y: 5 },
    topRight: { x: 10 + barWidth + gap + slant + barWidth, y: 5 },
    bottomRight: { x: 10 + barWidth + gap + barWidth, y: 95 },
    bottomLeft: { x: 10 + barWidth + gap, y: 95 },
  };

  const leftPoints = `${leftBar.topLeft.x},${leftBar.topLeft.y} ${leftBar.topRight.x},${leftBar.topRight.y} ${leftBar.bottomRight.x},${leftBar.bottomRight.y} ${leftBar.bottomLeft.x},${leftBar.bottomLeft.y}`;
  const rightPoints = `${rightBar.topLeft.x},${rightBar.topLeft.y} ${rightBar.topRight.x},${rightBar.topRight.y} ${rightBar.bottomRight.x},${rightBar.bottomRight.y} ${rightBar.bottomLeft.x},${rightBar.bottomLeft.y}`;

  return (
    <svg 
      viewBox="0 0 70 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`${sizeMap[size]} ${className}`}
      aria-label="enerva logo"
    >
      {/* Left slanted bar */}
      <polygon 
        points={leftPoints}
        fill={color || 'currentColor'}
        className={color ? '' : 'text-zinc-100'}
      />
      {/* Right slanted bar */}
      <polygon 
        points={rightPoints}
        fill={color || 'currentColor'}
        className={color ? '' : 'text-zinc-100'}
      />
    </svg>
  );
}
