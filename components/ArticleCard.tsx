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
 * Article Card Component
 * 
 * Displays an article with:
 * - Square cover image (real image or placeholder)
 * - Title
 * - Summary snippet (clamped to 2-3 lines)
 * - Metadata (source + time ago)
 * 
 * Entire card is clickable and opens article in new tab.
 */
export function ArticleCard({ article, priority = false }: ArticleCardProps) {
  const imageUrl = getArticleImage(article);
  const timeAgo = formatTimeAgo(article.pub_date);
  const hasRealImage = !!article.image_url && !isPlaceholderImage(imageUrl);

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800/50 
                 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all duration-300 
                 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20"
    >
      {/* Square Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-800">
        <ArticleImage
          src={imageUrl}
          alt={article.title}
          fallbackCategory={article.category}
          priority={priority}
          className="transition-transform duration-500 group-hover:scale-105"
        />
        {/* Category Badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="px-2.5 py-1 text-xs font-medium rounded-full 
                         bg-black/60 backdrop-blur-sm text-zinc-300 border border-zinc-700/50">
            {article.category}
          </span>
        </div>
        {/* Real Image Indicator */}
        {hasRealImage && (
          <div className="absolute bottom-2 right-2 z-10">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="text-base font-semibold text-zinc-100 leading-snug 
                       line-clamp-2 group-hover:text-cyan-400 transition-colors">
          {article.title}
        </h3>

        {/* Summary */}
        <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">
          {article.summary}
        </p>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-400">{article.source}</span>
          <span className="text-zinc-600">•</span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </a>
  );
}

/**
 * Hero Article Card (Featured)
 * 
 * Larger layout for the featured/most recent article.
 * Horizontal layout with image on the right.
 */
export function HeroArticleCard({ article }: { article: ArticleRow }) {
  const imageUrl = getArticleImage(article);
  const timeAgo = formatTimeAgo(article.pub_date);
  const hasRealImage = !!article.image_url && !isPlaceholderImage(imageUrl);

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-zinc-900/30 rounded-2xl overflow-hidden border border-zinc-800/50 
                 hover:border-zinc-700 transition-all duration-300"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 lg:p-8">
        {/* Content - Left Side */}
        <div className="flex flex-col justify-center space-y-4 order-2 lg:order-1">
          {/* Category Badge */}
          <div>
            <span className="px-3 py-1.5 text-xs font-medium rounded-full 
                           bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {article.category}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-cyan-400 
                         leading-tight group-hover:text-cyan-300 transition-colors">
            {article.title}
          </h2>

          {/* Meta */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
              <path strokeLinecap="round" d="M12 6v6l4 2" strokeWidth="1.5"/>
            </svg>
            <span>Published {timeAgo}</span>
          </div>

          {/* Summary */}
          <p className="text-base sm:text-lg text-zinc-300 leading-relaxed line-clamp-3">
            {article.summary}
          </p>

          {/* Source */}
          <div className="flex items-center gap-3 pt-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
              <span className="text-xs font-bold text-zinc-400">
                {article.source.charAt(0)}
              </span>
            </div>
            <span className="text-sm font-medium text-zinc-400">{article.source}</span>
          </div>
        </div>

        {/* Image - Right Side */}
        <div className="relative aspect-[4/3] lg:aspect-square w-full overflow-hidden rounded-xl bg-zinc-800 order-1 lg:order-2">
          <ArticleImage
            src={imageUrl}
            alt={article.title}
            fallbackCategory={article.category}
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="transition-transform duration-500 group-hover:scale-105"
          />
          {/* Real Image Indicator */}
          {hasRealImage && (
            <div className="absolute bottom-3 right-3 z-10">
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
