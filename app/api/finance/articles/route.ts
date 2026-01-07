import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes

/**
 * GET /api/finance/articles
 * 
 * Returns finance-related articles from the articles table.
 * Filters by article_type='finance'.
 * 
 * Query params:
 * - limit: number of articles to return (default: 6)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '6', 10);

    const supabase = getSupabase();
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('article_type', 'finance')
      .order('pub_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[finance/articles] Database error:', error);
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

