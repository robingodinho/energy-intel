import { NextRequest, NextResponse } from 'next/server';
import { runIngestion, IngestionStats } from '@/lib/ingest';

// Force dynamic rendering - no caching for ingestion endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Increase max duration for ingestion (Vercel Pro: 60s, Hobby: 10s)
export const maxDuration = 60;

/**
 * Protected ingestion endpoint for Vercel Cron
 * 
 * Security: Validates requests using x-cron-secret header
 * - Returns 401 if secret doesn't match CRON_SECRET env var
 * - Returns 200 with ingestion stats on success
 * 
 * This endpoint is called by:
 * - Vercel Cron on schedule (every 6 hours)
 * - Manual triggers for testing
 */
export async function GET(request: NextRequest) {
  // Validate cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  // Also check for Vercel's built-in cron authorization header
  const authHeader = request.headers.get('authorization');
  const isVercelCron = authHeader === `Bearer ${expectedSecret}`;

  // Allow if either x-cron-secret header matches OR Vercel's authorization header matches
  if (cronSecret !== expectedSecret && !isVercelCron) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing cron secret' },
      { status: 401 }
    );
  }

  try {
    console.log('[/api/ingest] Starting ingestion run...');
    
    const stats: IngestionStats = await runIngestion();
    
    console.log(`[/api/ingest] Completed: ${stats.totalItemsInserted} inserted, ${stats.totalItemsDuplicates} duplicates, ${stats.totalDbErrors} errors`);

    // Return summary response
    return NextResponse.json({
      success: true,
      message: 'Ingestion completed',
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
    console.error('[/api/ingest] Ingestion error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Ingestion failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
