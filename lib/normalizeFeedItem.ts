import { createHash } from 'crypto';
import { RawFeedItem, ArticleInsert, ArticleType } from '@/types/article';
import { categorizeArticle } from './categorize';

/**
 * Normalized article without summary (summary added later by AI)
 */
export type PartialArticle = Omit<ArticleInsert, 'summary'> & {
  article_type?: ArticleType;
};

/**
 * Generate a stable unique ID for an article
 * 
 * Prefers guid from RSS feed, falls back to hashing the link
 * 
 * @param item - Raw feed item
 * @returns Stable unique ID string
 */
export function generateArticleId(item: RawFeedItem): string {
  // Prefer guid if available
  if (item.guid && item.guid.trim()) {
    // Clean guid - remove any URL prefixes, keep just the identifier
    const cleanGuid = item.guid.trim();
    // Hash it to ensure consistent length and format
    return createHash('sha256').update(cleanGuid).digest('hex').slice(0, 16);
  }

  // Fallback: hash the link
  if (item.link && item.link.trim()) {
    return createHash('sha256').update(item.link.trim()).digest('hex').slice(0, 16);
  }

  // Last resort: hash title + pubDate
  const fallback = `${item.title || ''}:${item.pubDate || item.isoDate || ''}`;
  return createHash('sha256').update(fallback).digest('hex').slice(0, 16);
}

/**
 * Parse publication date from feed item
 * 
 * Prefers isoDate (already ISO format), falls back to pubDate
 * 
 * @param item - Raw feed item
 * @returns ISO 8601 date string
 */
export function parsePublicationDate(item: RawFeedItem): string {
  // Prefer isoDate (already in ISO format from rss-parser)
  if (item.isoDate) {
    return item.isoDate;
  }

  // Try parsing pubDate
  if (item.pubDate) {
    const parsed = new Date(item.pubDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  // Fallback to current time if no date available
  return new Date().toISOString();
}

/**
 * Normalize a candidate image URL from a feed item
 */
function normalizeImageUrl(rawUrl: string, baseUrl?: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const resolved = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Extract a URL from media:content or media:thumbnail values
 */
function extractMediaUrl(value: unknown, baseUrl?: string): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    return normalizeImageUrl(value, baseUrl);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = extractMediaUrl(entry, baseUrl);
      if (url) return url;
    }
    return null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.url === 'string') {
      return normalizeImageUrl(record.url, baseUrl);
    }
    if (typeof record.href === 'string') {
      return normalizeImageUrl(record.href, baseUrl);
    }
    const attrs = record.$ as Record<string, unknown> | undefined;
    if (attrs) {
      if (typeof attrs.url === 'string') {
        return normalizeImageUrl(attrs.url, baseUrl);
      }
      if (typeof attrs.href === 'string') {
        return normalizeImageUrl(attrs.href, baseUrl);
      }
    }
  }

  return null;
}

/**
 * Try to get a feed-provided image URL
 */
function extractFeedImage(item: RawFeedItem): string | null {
  const baseUrl = item.link;

  if (item.enclosure?.url) {
    const enclosureUrl = normalizeImageUrl(item.enclosure.url, baseUrl);
    if (enclosureUrl) return enclosureUrl;
  }

  const mediaUrl =
    extractMediaUrl(item['media:content'], baseUrl) ||
    extractMediaUrl(item['media:thumbnail'], baseUrl);
  if (mediaUrl) return mediaUrl;

  if (typeof item.image === 'string') {
    return normalizeImageUrl(item.image, baseUrl);
  }

  if (item.image && typeof item.image === 'object' && 'url' in item.image) {
    const urlValue = (item.image as { url?: string }).url;
    if (typeof urlValue === 'string') {
      return normalizeImageUrl(urlValue, baseUrl);
    }
  }

  const htmlCandidate = item.content || item.contentSnippet || '';
  const htmlImage = extractImgSrcFromHtml(htmlCandidate, baseUrl);
  if (htmlImage) return htmlImage;

  return null;
}

/**
 * Extract the first <img src> from an HTML-ish string
 */
function extractImgSrcFromHtml(value: string, baseUrl?: string): string | null {
  if (!value) return null;

  const decoded = value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

  const match = decoded.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match || !match[1]) return null;

  return normalizeImageUrl(match[1], baseUrl);
}


/**
 * Normalize a raw feed item into a partial article
 * 
 * Does NOT include summary (that's added by AI in Step 8)
 * 
 * @param item - Raw feed item from RSS parser
 * @param source - Source name (e.g., 'FERC', 'EPA')
 * @param articleType - Type of article ('policy' or 'finance')
 * @returns Partial article ready for categorization and summarization
 */
export function normalizeFeedItem(
  item: RawFeedItem,
  source: string,
  articleType: ArticleType = 'policy'
): PartialArticle | null {
  // Skip items without title or link
  if (!item.title?.trim() || !item.link?.trim()) {
    console.warn(`[normalizeFeedItem] Skipping item without title or link from ${source}`);
    return null;
  }

  const title = item.title.trim();
  const content = item.contentSnippet || item.content || '';
  const imageUrl = extractFeedImage(item);
  
  return {
    id: generateArticleId(item),
    title,
    link: item.link.trim(),
    pub_date: parsePublicationDate(item),
    source,
    category: categorizeArticle(title, content),
    article_type: articleType,
    image_url: imageUrl,
  };
}

/**
 * Normalize all items from a feed
 * 
 * @param items - Raw feed items
 * @param source - Source name
 * @param articleType - Type of article ('policy' or 'finance')
 * @returns Array of partial articles (nulls filtered out)
 */
export function normalizeFeedItems(
  items: RawFeedItem[],
  source: string,
  articleType: ArticleType = 'policy'
): PartialArticle[] {
  return items
    .map((item) => normalizeFeedItem(item, source, articleType))
    .filter((article): article is PartialArticle => article !== null);
}

