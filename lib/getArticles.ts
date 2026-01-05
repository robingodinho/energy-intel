import { getSupabase } from './db';
import { ArticleRow, ArticleCategory } from '@/types/article';

/**
 * Options for fetching articles
 */
export interface GetArticlesOptions {
  category?: ArticleCategory | 'All';
  limit?: number;
  offset?: number;
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
 * @param options - Query options (category, limit, offset)
 * @returns Articles sorted by pub_date DESC
 */
export async function getArticles(
  options: GetArticlesOptions = {}
): Promise<GetArticlesResult> {
  const { category, limit = 50, offset = 0 } = options;

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

