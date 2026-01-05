import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { summarizeArticle, isOpenAIConfigured } from '@/lib/summarize';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allow up to 300 seconds for re-summarization (many API calls)
export const maxDuration = 300;

/**
 * Re-summarization stats
 */
interface ResummarizationStats {
  total: number;
  updated: number;
  failed: number;
  skipped: number;
  tokensUsed: number;
  durationMs: number;
}

/**
 * Protected re-summarization endpoint
 * 
 * Re-generates AI summaries for articles that have placeholder summaries
 * (summaries that match or are similar to their titles).
 * 
 * Query params:
 * - limit: Max articles to process (default 20, max 50)
 * - force: If true, re-summarize ALL articles (not just placeholders)
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

  // Check if OpenAI is configured
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  const startTime = Date.now();
  console.log('[/api/resummarize] Starting re-summarization...');

  // Parse query params
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const forceParam = searchParams.get('force');
  
  const limit = Math.min(parseInt(limitParam || '20', 10), 150);
  const force = forceParam === 'true';

  try {
    const supabase = getSupabase();

    // Fetch articles that need re-summarization
    // A "placeholder" summary is one that matches or closely matches the title
    let query = supabase
      .from('articles')
      .select('id, title, summary, source')
      .order('pub_date', { ascending: false })
      .limit(limit);

    const { data: articles, error: queryError } = await query;

    if (queryError) {
      console.error('[/api/resummarize] Query error:', queryError);
      return NextResponse.json(
        { error: 'Database query failed', details: queryError.message },
        { status: 500 }
      );
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles found',
        stats: {
          total: 0,
          updated: 0,
          failed: 0,
          skipped: 0,
          tokensUsed: 0,
          durationMs: Date.now() - startTime,
        },
      });
    }

    // Filter to articles with placeholder summaries (unless force=true)
    const articlesToProcess = force
      ? articles
      : articles.filter((a) => isPlaceholderSummary(a.title, a.summary));

    console.log(`[/api/resummarize] Found ${articles.length} articles, ${articlesToProcess.length} need re-summarization`);

    const stats: ResummarizationStats = {
      total: articles.length,
      updated: 0,
      failed: 0,
      skipped: articles.length - articlesToProcess.length,
      tokensUsed: 0,
      durationMs: 0,
    };

    // Process each article
    for (const article of articlesToProcess) {
      console.log(`[/api/resummarize] Processing: ${article.title.slice(0, 50)}...`);

      const result = await summarizeArticle(article.title, undefined, article.source);

      if (result.success && result.summary) {
        // Update the article with the new summary
        const { error: updateError } = await supabase
          .from('articles')
          .update({ summary: result.summary })
          .eq('id', article.id);

        if (updateError) {
          console.error(`[/api/resummarize] Update error for ${article.id}:`, updateError);
          stats.failed++;
        } else {
          console.log(`[/api/resummarize] ✅ Updated: ${article.title.slice(0, 40)}...`);
          stats.updated++;
          stats.tokensUsed += result.tokensUsed || 0;
        }
      } else {
        console.log(`[/api/resummarize] ❌ Failed: ${article.title.slice(0, 40)}... - ${result.error}`);
        stats.failed++;
      }

      // Small delay between API calls to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    stats.durationMs = Date.now() - startTime;

    console.log(`[/api/resummarize] Completed: ${stats.updated} updated, ${stats.failed} failed, ${stats.skipped} skipped`);

    return NextResponse.json({
      success: true,
      message: 'Re-summarization completed',
      stats,
    });
  } catch (error) {
    console.error('[/api/resummarize] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Re-summarization failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Check if a summary appears to be a placeholder (matches or is truncated title)
 */
function isPlaceholderSummary(title: string, summary: string): boolean {
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedSummary = summary.toLowerCase().trim();

  // Exact match
  if (normalizedTitle === normalizedSummary) {
    return true;
  }

  // Summary is truncated version of title
  if (normalizedTitle.startsWith(normalizedSummary.replace('...', ''))) {
    return true;
  }

  // Summary ends with "..." and matches start of title
  if (normalizedSummary.endsWith('...')) {
    const summaryPrefix = normalizedSummary.slice(0, -3);
    if (normalizedTitle.startsWith(summaryPrefix)) {
      return true;
    }
  }

  // Very short summary relative to title (likely placeholder)
  if (summary.length < 100 && summary.length <= title.length) {
    // Check for high overlap
    const titleWords = new Set(normalizedTitle.split(/\s+/));
    const summaryWords = normalizedSummary.split(/\s+/);
    const overlapCount = summaryWords.filter((w) => titleWords.has(w)).length;
    const overlapRatio = overlapCount / summaryWords.length;
    
    if (overlapRatio > 0.8) {
      return true;
    }
  }

  return false;
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

