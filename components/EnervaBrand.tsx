'use client';

interface EnervaBrandProps {
  size?: 'header' | 'large' | 'small';
  animate?: boolean;
  glow?: boolean;
  underline?: boolean;
  showDomain?: boolean;
  className?: string;
}

/**
 * EnervaBrand Component
 * 
 * Renders the "enerva.ai" brand name with elegant serif typography.
 * Uses Cormorant Garamond font with custom styling to match the brand aesthetic:
 * - Elegant serifs with high contrast between thick and thin strokes
 * - Distinctive lowercase styling with generous letter spacing
 * - Optional glow, shine animation, and underline effects
 * - ".ai" suffix in cyan accent color
 */
export function EnervaBrand({ 
  size = 'header', 
  animate = false, 
  glow = false,
  underline = false,
  showDomain = true,
  className = '' 
}: EnervaBrandProps) {
  const sizeClasses = {
    small: 'text-xl sm:text-2xl',
    header: 'enerva-brand-header',
    large: 'enerva-brand-large',
  };

  const classes = [
    'enerva-brand',
    sizeClasses[size],
    glow && 'enerva-brand-glow',
    animate && 'enerva-brand-shine',
    underline && 'enerva-brand-underline',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      enerva
    </span>
  );
}
