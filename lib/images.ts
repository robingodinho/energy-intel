import { ArticleCategory } from '@/types/article';

/**
 * Placeholder image mapping for article categories
 * 
 * These are fallback SVG placeholders used when:
 * - image_url is null/undefined
 * - image_url fails to load
 */
const CATEGORY_IMAGES: Record<ArticleCategory | 'default', string> = {
  'LNG': '/placeholders/lng.svg',
  'Renewable Energy': '/placeholders/renewable-energy.svg',
  'Energy Policy': '/placeholders/energy-policy.svg',
  'Emissions': '/placeholders/emissions.svg',
  'Infrastructure': '/placeholders/infrastructure.svg',
  'default': '/placeholders/default.svg',
};

/**
 * Get the image URL for an article
 * 
 * Priority:
 * 1. article.image_url (scraped OpenGraph/Twitter image)
 * 2. Category-based placeholder
 * 3. Default placeholder
 * 
 * @param article - Article with optional image_url and category
 * @returns Image URL string
 */
const SOURCE_FALLBACK_IMAGES: Record<string, string> = {
  'Utility Dive': 'https://www.utilitydive.com/img/utility-dive-og-image.png',
  'Power Magazine': 'https://www.powermag.com/wp-content/uploads/2023/01/power-magazine-logo.png',
  'Yahoo Finance': 'https://s.yimg.com/cv/apiv2/cv/apiv2/social/images/yahoo-finance-default-logo.png',
  'CNBC Energy': 'https://image.cnbcfm.com/api/v1/image/106989771-1645799587799-gettyimages-1238765092-AFP_324P9VM.jpeg',
};

export function getArticleImage(article: {
  image_url?: string | null;
  category?: ArticleCategory | string;
  source?: string | null;
}): string {
  // Use scraped image_url if available
  if (article.image_url && isValidImageUrl(article.image_url)) {
    return article.image_url;
  }

  // Source-based fallback (brand images) if scraping failed
  if (article.source && SOURCE_FALLBACK_IMAGES[article.source]) {
    return SOURCE_FALLBACK_IMAGES[article.source];
  }

  // Use category-based placeholder
  const category = article.category as ArticleCategory;
  if (category && CATEGORY_IMAGES[category]) {
    return CATEGORY_IMAGES[category];
  }

  return CATEGORY_IMAGES.default;
}

/**
 * Validate that an image URL is usable
 */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must be http or https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // Skip data URLs (shouldn't happen but just in case)
    if (url.startsWith('data:')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get placeholder image for a category
 */
export function getCategoryPlaceholder(category: ArticleCategory): string {
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.default;
}

/**
 * Check if an image URL is a placeholder
 */
export function isPlaceholderImage(url: string): boolean {
  return url.startsWith('/placeholders/');
}
