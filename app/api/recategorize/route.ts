import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { categorizeArticle } from '@/lib/categorize';
import { ArticleCategory } from '@/types/article';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allow up to 60 seconds for recategorization
export const maxDuration = 60;

/**
 * Recategorization stats
 */
interface RecategorizationStats {
  total: number;
  updated: number;
  unchanged: number;
  failed: number;
  categoryBreakdown: Record<ArticleCategory, number>;
  durationMs: number;
}

/**
 * Protected recategorization endpoint
 * 
 * Re-applies keyword-based categorization to all articles in the database.
 * This is useful after updating the categorization logic.
 * 
 * Security: Protected by CRON_SECRET (same as /api/ingest)
 */
export async function GET(request: NextRequest) {
  // Validate cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isVercelCron = authHeader === `Bearer ${expectedSecret}`;

  if (cronSecret !== expectedSecret && !isVercelCron) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing cron secret' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  console.log('[/api/recategorize] Starting recategorization...');

  try {
    const supabase = getSupabase();

    // Fetch all articles with their title and current category
    const { data: articles, error: queryError } = await supabase
      .from('articles')
      .select('id, title, category')
      .order('pub_date', { ascending: false });

    if (queryError) {
      console.error('[/api/recategorize] Query error:', queryError);
      return NextResponse.json(
        { error: 'Database query failed', details: queryError.message },
        { status: 500 }
      );
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles to recategorize',
        stats: {
          total: 0,
          updated: 0,
          unchanged: 0,
          failed: 0,
          categoryBreakdown: {},
          durationMs: Date.now() - startTime,
        },
      });
    }

    console.log(`[/api/recategorize] Processing ${articles.length} articles...`);

    const stats: RecategorizationStats = {
      total: articles.length,
      updated: 0,
      unchanged: 0,
      failed: 0,
      categoryBreakdown: {
        'LNG': 0,
        'Renewable Energy': 0,
        'Energy Policy': 0,
        'Emissions': 0,
        'Infrastructure': 0,
      },
      durationMs: 0,
    };

    // Process articles in batches
    const updates: { id: string; category: ArticleCategory }[] = [];

    for (const article of articles) {
      const newCategory = categorizeArticle(article.title);
      stats.categoryBreakdown[newCategory]++;

      if (article.category !== newCategory) {
        updates.push({ id: article.id, category: newCategory });
      } else {
        stats.unchanged++;
      }
    }

    // Apply updates in batches
    if (updates.length > 0) {
      console.log(`[/api/recategorize] Updating ${updates.length} articles...`);
      
      // Update each article individually (Supabase doesn't support bulk different updates)
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('articles')
          .update({ category: update.category })
          .eq('id', update.id);

        if (updateError) {
          console.error(`[/api/recategorize] Update error for ${update.id}:`, updateError);
          stats.failed++;
        } else {
          stats.updated++;
        }
      }
    }

    stats.durationMs = Date.now() - startTime;

    console.log(`[/api/recategorize] Completed: ${stats.updated} updated, ${stats.unchanged} unchanged, ${stats.failed} failed`);
    console.log('[/api/recategorize] Category breakdown:', stats.categoryBreakdown);

    return NextResponse.json({
      success: true,
      message: 'Recategorization completed',
      stats,
    });
  } catch (error) {
    console.error('[/api/recategorize] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Recategorization failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

