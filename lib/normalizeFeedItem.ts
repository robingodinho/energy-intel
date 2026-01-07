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
  
  return {
    id: generateArticleId(item),
    title,
    link: item.link.trim(),
    pub_date: parsePublicationDate(item),
    source,
    category: categorizeArticle(title, content),
    article_type: articleType,
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

