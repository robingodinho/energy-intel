'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { ArticleRow } from '@/types/article';
import { getArticleImage, getCategoryPlaceholder, isPlaceholderImage } from '@/lib/images';
import { formatTimeAgo } from '@/lib/getArticles';

interface ArticleCardProps {
  article: ArticleRow;
  priority?: boolean;
}

/**
 * Article Image Component
 * 
 * Handles both external images (with Next/Image) and local SVG placeholders (with img tag)
 */
function ArticleImage({ 
  src, 
  alt, 
  fallbackCategory,
  priority = false,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  className = ""
}: { 
  src: string; 
  alt: string; 
  fallbackCategory: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const [imageSrc, setImageSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  
  // Reset state when src prop changes (e.g., when article changes)
  useEffect(() => {
    setImageSrc(src);
    setHasError(false);
  }, [src]);
  
  const isPlaceholder = isPlaceholderImage(imageSrc);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(getCategoryPlaceholder(fallbackCategory as any));
    }
  };

  // For local SVG placeholders, use a regular img tag
  if (isPlaceholder) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover ${className}`}
        onError={handleError}
      />
    );
  }

  // For external images, use Next/Image with unoptimized
  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes={sizes}
      className={`object-cover ${className}`}
      priority={priority}
      onError={handleError}
      unoptimized
    />
  );
}

/**
 * Source Icons Component
 * Shows small circular icons representing sources
 */
function SourceBadge({ source }: { source: string }) {
  const getSourceColor = (src: string) => {
    const colors: Record<string, string> = {
      'FERC': 'bg-red-500',
      'EPA': 'bg-green-500',
      'DOE': 'bg-blue-500',
      'EIA': 'bg-amber-500',
    };
    return colors[src] || 'bg-zinc-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-5 h-5 rounded-full ${getSourceColor(source)} flex items-center justify-center`}>
        <span className="text-[10px] font-bold text-white">
          {source.charAt(0)}
        </span>
      </div>
      <span className="text-xs text-zinc-500">{source}</span>
    </div>
  );
}

/**
 * Article Card Component (Medium Size)
 * 
 * Used in 3-column rows with:
 * - Image on TOP
 * - Title and summary BELOW
 */
export function ArticleCard({ article, priority = false }: ArticleCardProps) {
  const imageUrl = getArticleImage(article);
  const timeAgo = formatTimeAgo(article.pub_date);

  return (
    <div className="article-card-wrapper h-full">
      <a
        href={article.link}
        className="group flex flex-col bg-zinc-900/50 rounded-2xl overflow-hidden border border-zinc-800/50 
                   transition-all duration-300 h-full p-4 relative z-10"
      >
        {/* Image Container - 16:10 aspect ratio with rounded corners */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-800 rounded-xl">
          <ArticleImage
            src={imageUrl}
            alt={article.title}
            fallbackCategory={article.category}
            priority={priority}
            className="transition-transform duration-500 group-hover:scale-110"
          />
          {/* Category Badge */}
          <div className="absolute top-3 left-3 z-10">
            <span className="px-2.5 py-1 text-xs font-medium rounded-full 
                           bg-black/60 backdrop-blur-sm text-zinc-300 border border-zinc-700/50">
              {article.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 pt-4">
          {/* Title */}
          <h3 className="text-lg font-semibold text-zinc-100 leading-snug 
                         line-clamp-2 group-hover:text-cyan-400 transition-colors duration-300 mb-3">
            {article.title}
          </h3>

          {/* Summary */}
          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2 flex-1 
                        group-hover:text-zinc-300 transition-colors duration-300">
            {article.summary}
          </p>

          {/* Footer: Source and Time */}
          <div className="flex items-center justify-between mt-4">
            <SourceBadge source={article.source} />
            <span className="text-xs text-zinc-500">{timeAgo}</span>
          </div>
        </div>
      </a>
    </div>
  );
}

/**
 * Large Article Card Component
 * 
 * Full-width card with image on left OR right side.
 * Used for featured articles in the repeating pattern.
 */
interface LargeArticleCardProps {
  article: ArticleRow;
  imagePosition?: 'left' | 'right';
  priority?: boolean;
}

export function LargeArticleCard({ 
  article, 
  imagePosition = 'right',
  priority = false 
}: LargeArticleCardProps) {
  const imageUrl = getArticleImage(article);
  const timeAgo = formatTimeAgo(article.pub_date);

  const isImageLeft = imagePosition === 'left';

  return (
    <div className="article-card-wrapper">
      <a
        href={article.link}
        className="group block bg-zinc-900/30 rounded-2xl overflow-hidden border border-zinc-800/50 
                   transition-all duration-300 relative z-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5">
          {/* Image Side - Same aspect ratio as medium cards */}
          <div className={`relative aspect-[16/10] w-full overflow-hidden bg-zinc-800 rounded-xl
                          ${isImageLeft ? 'order-1' : 'order-1 lg:order-2'}`}>
            <ArticleImage
              src={imageUrl}
              alt={article.title}
              fallbackCategory={article.category}
              priority={priority}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="transition-transform duration-500 group-hover:scale-110"
            />
            {/* Category Badge on Image */}
            <div className="absolute top-4 left-4 z-10">
              <span className="px-3 py-1.5 text-xs font-medium rounded-full 
                             bg-black/60 backdrop-blur-sm text-zinc-300 border border-zinc-700/50">
                {article.category}
              </span>
            </div>
          </div>

          {/* Content Side */}
          <div className={`flex flex-col justify-center py-2 
                          ${isImageLeft ? 'order-2' : 'order-2 lg:order-1'}`}>
            {/* Time Published */}
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4 
                            group-hover:text-zinc-400 transition-colors duration-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                <path strokeLinecap="round" d="M12 6v6l4 2" strokeWidth="1.5"/>
              </svg>
              <span>Published {timeAgo}</span>
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 
                           leading-tight group-hover:text-cyan-400 transition-colors duration-300 mb-4">
              {article.title}
            </h2>

            {/* Summary */}
            <p className="text-base text-zinc-400 leading-relaxed line-clamp-3 mb-6 
                          group-hover:text-zinc-300 transition-colors duration-300">
              {article.summary}
            </p>

            {/* Footer: Sources */}
            <div className="flex items-center gap-4">
              <SourceBadge source={article.source} />
              <span className="text-xs text-zinc-600">•</span>
              <span className="text-xs text-zinc-500 group-hover:text-cyan-400 transition-colors duration-300">
                Read more →
              </span>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}

/**
 * Hero Article Card (Legacy - kept for compatibility)
 * 
 * Redirects to LargeArticleCard with imagePosition='right'
 */
export function HeroArticleCard({ article }: { article: ArticleRow }) {
  return <LargeArticleCard article={article} imagePosition="right" priority />;
}
