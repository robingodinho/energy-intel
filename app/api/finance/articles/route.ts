import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // always fresh for finance articles

/**
 * GET /api/finance/articles
 * 
 * Returns finance-related articles from the articles table.
 * Filters by article_type='finance'.
 * 
 * Query params:
 * - limit: number of articles to return (default: 6)
 * - archived: 'true' to get archived articles, 'false' or omit for active articles
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '6', 10);
    const showArchived = searchParams.get('archived') === 'true';

    const supabase = getSupabase();
    
    let query = supabase
      .from('articles')
      .select('*')
      .eq('article_type', 'finance')
      .order('pub_date', { ascending: false });

    // Filter by archived status
    // Note: If is_archived column doesn't exist yet, this will return all articles
    // After running migration 003, this will properly filter
    // Use .or() to include NULL values for non-archived articles (older articles may have NULL)
    if (showArchived) {
      query = query.eq('is_archived', true);
    } else {
      query = query.or('is_archived.eq.false,is_archived.is.null');
    }

    query = query.limit(limit);

    const { data: articles, error } = await query;

    if (error) {
      console.error('[finance/articles] Database error:', error);
      // If error is about is_archived column not existing, fallback to unfiltered
      if (error.message?.includes('is_archived')) {
        const { data: fallbackArticles, error: fallbackError } = await supabase
          .from('articles')
          .select('*')
          .eq('article_type', 'finance')
          .order('pub_date', { ascending: false })
          .limit(limit);

        if (fallbackError) {
          return NextResponse.json({
            articles: [],
            error: 'Failed to fetch articles',
          }, { status: 500 });
        }

        const transformedArticles = (fallbackArticles || []).map(article => ({
          id: article.id,
          title: article.title,
          summary: article.summary,
          source: article.source,
          link: article.link,
          pubDate: article.pub_date,
          imageUrl: article.image_url,
          category: article.category,
          timeAgo: getTimeAgo(new Date(article.pub_date)),
        }));

        return NextResponse.json({
          articles: transformedArticles,
          count: transformedArticles.length,
          note: 'Archive filter not available - run migration 003',
        });
      }

      return NextResponse.json({
        articles: [],
        error: 'Failed to fetch articles',
      }, { status: 500 });
    }

    // Transform to frontend format
    const transformedArticles = (articles || []).map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      source: article.source,
      link: article.link,
      pubDate: article.pub_date,
      imageUrl: article.image_url,
      category: article.category,
      timeAgo: getTimeAgo(new Date(article.pub_date)),
    }));

    return NextResponse.json({
      articles: transformedArticles,
      count: transformedArticles.length,
      archived: showArchived,
    });
  } catch (error) {
    console.error('[finance/articles] Error:', error);
    return NextResponse.json({
      articles: [],
      error: 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Convert date to "X hours ago" format
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  // Handle future dates or very recent articles
  if (diffMs < 0 || diffMs < 60000) {
    return 'Just now';
  }
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
}

