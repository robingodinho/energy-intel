import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runIngestion, IngestionStats } from '@/lib/ingest';
import { getEnabledFeedsByType } from '@/lib/feeds';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Qatar-only ingestion endpoint (fast inline run).
 * Filters enabled finance feeds to Qatar-specific sources.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const maxItemsParam = searchParams.get('maxItems');
  const maxItemsPerFeed = maxItemsParam ? Number.parseInt(maxItemsParam, 10) : undefined;
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

  try {
    console.log('[/api/ingest-qatar] Starting Qatar-only ingestion...');

    const financeFeeds = getEnabledFeedsByType('finance');
    // Only ingest from Qatar energy Google News feeds
    const qatarFeeds = financeFeeds.filter((feed) =>
      /^Qatar Energy( Finance)?|^Gulf Times Qatar Energy/i.test(feed.name)
    );

    const stats: IngestionStats = await runIngestion(qatarFeeds, {
      maxItemsPerFeed: Number.isFinite(maxItemsPerFeed) ? maxItemsPerFeed : undefined,
    });

    console.log(
      `[/api/ingest-qatar] Completed: ${stats.totalItemsInserted} inserted, ${stats.totalItemsDuplicates} duplicates, ${stats.totalDbErrors} errors`
    );

    try {
      revalidatePath('/finance');
      revalidatePath('/');
    } catch (revalidateError) {
      console.warn('[/api/ingest-qatar] Revalidate warning:', revalidateError);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Qatar ingestion completed',
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
          },
          perSource: stats.perSource.map((s) => ({
            source: s.source,
            status: s.fetchStatus,
            fetched: s.itemsFetched,
            inserted: s.itemsInserted,
            skipped: s.itemsSkipped,
          })),
          errors: stats.errors.length > 0 ? stats.errors : undefined,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[/api/ingest-qatar] Ingestion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Qatar ingestion failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
