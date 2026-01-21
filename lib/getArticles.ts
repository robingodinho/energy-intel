import { getSupabase } from './db';
import { ArticleRow, ArticleCategory } from '@/types/article';

/**
 * Time range options for archive filtering
 */
export type TimeRange = 'latest' | '24h' | '7d' | '30d' | '90d';

/**
 * Options for fetching articles
 */
export interface GetArticlesOptions {
  category?: ArticleCategory | 'All';
  limit?: number;
  offset?: number;
  includeFinance?: boolean; // Whether to include finance articles (default: false)
  timeRange?: TimeRange; // Time range filter for archive
}

// Finance sources that should be excluded from main feed
const FINANCE_SOURCES = [
  'Yahoo Finance',
  'CNBC Energy',
  'Club of Mozambique',
  'ESI Africa Mozambique',
  'Engineering News Energy',
  'Mozambique Energy (Google News)',
  'Mozambique LNG Finance (Google News)',
];

/**
 * Get date range boundaries based on time range option
 */
function getDateRange(timeRange: TimeRange): { start: Date; end: Date } | null {
  const now = new Date();
  
  if (timeRange === 'latest') {
    return null; // No filtering, show latest articles
  }
  
  const end = now;
  let start: Date;
  
  switch (timeRange) {
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      return null;
  }
  
  return { start, end };
}

/**
 * Result from fetching articles
 */
export interface GetArticlesResult {
  articles: ArticleRow[];
  error: string | null;
}

/**
 * Fetch articles from Supabase (server-side only)
 * 
 * @param options - Query options (category, limit, offset, includeFinance, timeRange)
 * @returns Articles sorted by pub_date DESC
 */
export async function getArticles(
  options: GetArticlesOptions = {}
): Promise<GetArticlesResult> {
  const { category, limit = 25, offset = 0, includeFinance = false, timeRange = 'latest' } = options;

  try {
    const supabase = getSupabase();

    let query = supabase
      .from('articles')
      .select('*')
      .order('pub_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply category filter if specified and not "All"
    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    // Exclude finance sources from main feed by default
    if (!includeFinance) {
      // Filter out Yahoo Finance and CNBC Energy articles
      for (const source of FINANCE_SOURCES) {
        query = query.neq('source', source);
      }
    }

    // Apply time range filter for archive
    const dateRange = getDateRange(timeRange);
    if (dateRange) {
      query = query
        .gte('pub_date', dateRange.start.toISOString())
        .lte('pub_date', dateRange.end.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getArticles] Supabase error:', error);
      return { articles: [], error: error.message };
    }

    return { articles: (data as ArticleRow[]) || [], error: null };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[getArticles] Error:', errorMsg);
    return { articles: [], error: errorMsg };
  }
}

/**
 * Get a single featured article (most recent)
 */
export async function getFeaturedArticle(): Promise<ArticleRow | null> {
  const { articles } = await getArticles({ limit: 1 });
  return articles[0] || null;
}

/**
 * Get articles excluding the featured one
 */
export async function getGridArticles(
  options: GetArticlesOptions = {}
): Promise<GetArticlesResult> {
  const { limit = 50, ...rest } = options;
  // Get one extra to account for featured article we'll exclude
  const result = await getArticles({ ...rest, limit: limit + 1 });
  
  if (result.articles.length > 0) {
    // Remove the first article (it's the featured one)
    result.articles = result.articles.slice(1);
  }
  
  return result;
}

/**
 * Format relative time from pub_date
 */
export function formatTimeAgo(pubDate: string): string {
  const date = new Date(pubDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  if (diffWeeks > 0) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  return 'Just now';
}

