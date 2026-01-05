import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { scrapeArticleImage } from '@/lib/scrapeImage';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allow up to 60 seconds for enrichment (Vercel Pro: 60s, Hobby: 10s)
export const maxDuration = 60;

/**
 * Enrichment stats returned by the API
 */
interface EnrichmentStats {
  checked: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: { source: string; link: string; reason: string }[];
  durationMs: number;
}

/**
 * Protected image enrichment endpoint
 * 
 * Fetches articles with missing image_url and attempts to scrape
 * OpenGraph/Twitter card images from their source pages.
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
  console.log('[/api/enrich-images] Starting enrichment run...');

  try {
    const supabase = getSupabase();

    // Query articles with missing image_url, ordered by pub_date DESC, limit 15
    const { data: articles, error: queryError } = await supabase
      .from('articles')
      .select('id, link, source, title')
      .is('image_url', null)
      .order('pub_date', { ascending: false })
      .limit(15);

    if (queryError) {
      console.error('[/api/enrich-images] Query error:', queryError);
      return NextResponse.json(
        { error: 'Database query failed', details: queryError.message },
        { status: 500 }
      );
    }

    if (!articles || articles.length === 0) {
      console.log('[/api/enrich-images] No articles need enrichment');
      return NextResponse.json({
        success: true,
        message: 'No articles need enrichment',
        stats: {
          checked: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
          failures: [],
          durationMs: Date.now() - startTime,
        },
      });
    }

    console.log(`[/api/enrich-images] Found ${articles.length} articles to enrich`);

    const stats: EnrichmentStats = {
      checked: articles.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      failures: [],
      durationMs: 0,
    };

    // Process each article
    for (const article of articles) {
      console.log(`[/api/enrich-images] Scraping: ${article.source} - ${article.title.slice(0, 40)}...`);
      
      const result = await scrapeArticleImage(article.link);

      if (result.success && result.imageUrl) {
        // Update the article with the found image URL
        const { error: updateError } = await supabase
          .from('articles')
          .update({ image_url: result.imageUrl })
          .eq('id', article.id);

        if (updateError) {
          console.error(`[/api/enrich-images] Update error for ${article.id}:`, updateError);
          stats.failed++;
          stats.failures.push({
            source: article.source,
            link: article.link,
            reason: `DB update failed: ${updateError.message}`,
          });
        } else {
          console.log(`[/api/enrich-images] ✅ Updated: ${article.source} - ${result.imageUrl.slice(0, 60)}`);
          stats.updated++;
        }
      } else {
        // Failed to scrape image
        stats.failed++;
        stats.failures.push({
          source: article.source,
          link: article.link.slice(0, 80),
          reason: result.error || 'Unknown error',
        });
        console.log(`[/api/enrich-images] ❌ Failed: ${article.source} - ${result.error}`);
      }

      // Small delay between requests to be polite (300ms)
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    stats.durationMs = Date.now() - startTime;

    console.log(`[/api/enrich-images] Completed: ${stats.updated} updated, ${stats.failed} failed in ${stats.durationMs}ms`);

    return NextResponse.json({
      success: true,
      message: 'Enrichment completed',
      stats,
    });
  } catch (error) {
    console.error('[/api/enrich-images] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Enrichment failed',
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

