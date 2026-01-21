import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runIngestion, IngestionStats } from '@/lib/ingest';
import { getEnabledFeedsByType } from '@/lib/feeds';

// Force dynamic rendering - no caching for ingestion endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Finance-only ingestion endpoint (inline, no background tasks)
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

  try {
    console.log('[/api/ingest-finance] Starting finance-only ingestion...');

    const financeFeeds = getEnabledFeedsByType('finance');
    // Exclude Mozambique-specific feeds from the US finance ingest
    const usFinanceFeeds = financeFeeds.filter((feed) =>
      !/mozambique|club of mozambique/i.test(feed.name)
    );
    const stats: IngestionStats = await runIngestion(usFinanceFeeds);

    console.log(
      `[/api/ingest-finance] Completed: ${stats.totalItemsInserted} inserted, ${stats.totalItemsDuplicates} duplicates, ${stats.totalDbErrors} errors`
    );

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
