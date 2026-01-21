import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runIngestion, IngestionStats } from '@/lib/ingest';
import { getEnabledFeedsByType } from '@/lib/feeds';

// Force dynamic rendering - no caching for ingestion endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Policy-only ingestion endpoint (inline, no background tasks)
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
    console.log('[/api/ingest-policy] Starting policy-only ingestion...');

    const policyFeeds = getEnabledFeedsByType('policy');
    const stats: IngestionStats = await runIngestion(policyFeeds);

    console.log(
      `[/api/ingest-policy] Completed: ${stats.totalItemsInserted} inserted, ${stats.totalItemsDuplicates} duplicates, ${stats.totalDbErrors} errors`
    );

    // Revalidate main pages so latest policy articles appear quickly
    try {
      revalidatePath('/');
      revalidatePath('/about');
    } catch (revalidateError) {
      console.warn('[/api/ingest-policy] Revalidate warning:', revalidateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Policy ingestion completed',
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
    console.error('[/api/ingest-policy] Ingestion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Policy ingestion failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
