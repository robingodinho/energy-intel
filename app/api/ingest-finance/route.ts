import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runIngestion, IngestionStats } from '@/lib/ingest';
import { getEnabledFeedsByType } from '@/lib/feeds';
import { archiveOldFinanceArticles, getSupabase } from '@/lib/db';
import { scrapeArticleImage } from '@/lib/scrapeImage';

// Force dynamic rendering - no caching for ingestion endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// A single scrape can take ~20s (page timeout plus metadata fallback), so stop
// starting new ones well before maxDuration. /api/enrich-images picks up the rest.
const IMAGE_ENRICH_DEADLINE_MS = 35_000;

const ACTIVE_ARTICLES_PER_US_SOURCE = 3;

/**
 * Finance-only ingestion endpoint (inline, no background tasks)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
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

  const routeStartedAt = Date.now();

  try {
    console.log('[/api/ingest-finance] Starting finance-only ingestion...');

    const usSources = ['Yahoo Finance', 'CNBC Energy'];
    const financeFeeds = getEnabledFeedsByType('finance');
    const usFinanceFeeds = financeFeeds.filter((feed) => usSources.includes(feed.name));
    const maxItemsPerFeed = Math.max(1, Math.min(50, parseInt(searchParams.get('maxItems') || '25', 10)));
    const stats: IngestionStats = await runIngestion(usFinanceFeeds, { maxItemsPerFeed });

    console.log(
      `[/api/ingest-finance] Completed: ${stats.totalItemsInserted} inserted, ${stats.totalItemsDuplicates} duplicates, ${stats.totalDbErrors} errors`
    );

    // Keep the 3 newest per source active (6 total) so CNBC's few daily stories
    // aren't pushed out of Recent Developments by Yahoo's much higher volume.
    const archiveResult = { archived: 0 };
    for (const source of usSources) {
      const result = await archiveOldFinanceArticles([source], ACTIVE_ARTICLES_PER_US_SOURCE);
      archiveResult.archived += result.archived;
      if (result.error) {
        console.warn(`[/api/ingest-finance] Archive warning for ${source}:`, result.error);
      }
    }
    if (archiveResult.archived > 0) {
      console.log(`[/api/ingest-finance] Archived ${archiveResult.archived} older articles`);
    }

    // The Yahoo headline RSS feed carries no image fields, so scrape covers
    // now rather than leaving fresh US cards bare until the next enrich run.
    let usImageUpdates = 0;
    const supabase = getSupabase();
    const { data: usMissingImages, error: usMissingError } = await supabase
      .from('articles')
      .select('id, link, source, title')
      .in('source', usSources)
      .is('image_url', null)
      .order('is_archived', { ascending: true, nullsFirst: true })
      .order('pub_date', { ascending: false })
      .limit(12);

    if (usMissingError) {
      console.warn('[/api/ingest-finance] Image enrichment query warning:', usMissingError.message);
    } else if (usMissingImages && usMissingImages.length > 0) {
      console.log(`[/api/ingest-finance] Enriching ${usMissingImages.length} US finance articles missing images...`);
      for (const article of usMissingImages) {
        if (Date.now() - routeStartedAt > IMAGE_ENRICH_DEADLINE_MS) {
          console.log('[/api/ingest-finance] Image enrichment deadline reached; leaving the rest for /api/enrich-images');
          break;
        }

        const scrapeResult = await scrapeArticleImage(article.link);
        if (scrapeResult.success && scrapeResult.imageUrl) {
          const { error: updateError } = await supabase
            .from('articles')
            .update({ image_url: scrapeResult.imageUrl })
            .eq('id', article.id);

          if (updateError) {
            console.warn(`[/api/ingest-finance] Image update warning for ${article.id}:`, updateError.message);
          } else {
            usImageUpdates++;
          }
        } else {
          console.warn(`[/api/ingest-finance] Image scrape failed for ${article.source}: ${scrapeResult.error || 'Unknown error'}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      console.log(`[/api/ingest-finance] Enriched ${usImageUpdates} US finance article images`);
    }

    // Revalidate pages so latest finance articles appear quickly
    try {
      revalidatePath('/finance');
      revalidatePath('/');
    } catch (revalidateError) {
      console.warn('[/api/ingest-finance] Revalidate warning:', revalidateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Finance ingestion completed',
      stats: {
        startedAt: stats.startedAt,
        completedAt: stats.completedAt,
        durationMs: stats.durationMs,
        sources: {
          total: stats.totalSources,
          successful: stats.successfulSources,
          failed: stats.failedSources,
        },
        articles: {
          fetched: stats.totalItemsFetched,
          attempted: stats.totalItemsAttempted,
          inserted: stats.totalItemsInserted,
          duplicates: stats.totalItemsDuplicates,
          skipped: stats.totalItemsSkipped,
          dbErrors: stats.totalDbErrors,
          archived: archiveResult.archived,
          imageEnriched: usImageUpdates,
        },
        perSource: stats.perSource.map(s => ({
          source: s.source,
          status: s.fetchStatus,
          fetched: s.itemsFetched,
          inserted: s.itemsInserted,
          skipped: s.itemsSkipped,
        })),
        errors: stats.errors.length > 0 ? stats.errors : undefined,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('[/api/ingest-finance] Ingestion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Finance ingestion failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

