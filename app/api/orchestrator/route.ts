import { NextRequest, NextResponse } from 'next/server';
import { runIngestion } from '@/lib/ingest';
import { getSupabase } from '@/lib/db';
import { scrapeArticleImage } from '@/lib/scrapeImage';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allow up to 300 seconds for both tasks
export const maxDuration = 300;

/**
 * Orchestrator endpoint that runs both ingestion and image enrichment sequentially
 * 
 * This combines two tasks into a single cron job:
 * 1. Ingest new articles from RSS feeds (with AI summarization)
 * 2. Enrich articles with missing images
 * 
 * Security: Protected by CRON_SECRET
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
  console.log('[/api/orchestrator] Starting orchestrated tasks...');

  const results = {
    ingestion: null as any,
    enrichment: null as any,
    totalDurationMs: 0,
  };

  try {
    // ========================================
    // TASK 1: Run Ingestion
    // ========================================
    console.log('[/api/orchestrator] Task 1: Starting ingestion...');
    
    const ingestionStats = await runIngestion();
    results.ingestion = {
      success: true,
      newArticles: ingestionStats.totalItemsInserted,
      duplicates: ingestionStats.totalItemsDuplicates,
      sources: {
        total: ingestionStats.totalSources,
        successful: ingestionStats.successfulSources,
      },
      summarization: ingestionStats.summarization,
      durationMs: ingestionStats.durationMs,
    };
    
    console.log(
      `[/api/orchestrator] Task 1 Complete: ${ingestionStats.totalItemsInserted} new articles ingested`
    );

    // ========================================
    // TASK 2: Enrich Images
    // ========================================
    console.log('[/api/orchestrator] Task 2: Starting image enrichment...');
    
    const supabase = getSupabase();
    const limit = 15; // Process 15 articles per run

    const { data: articlesToEnrich, error: fetchError } = await supabase
      .from('articles')
      .select('id, link, source, title')
      .is('image_url', null)
      .order('pub_date', { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error('[/api/orchestrator] Error fetching articles for enrichment:', fetchError);
      results.enrichment = {
        success: false,
        error: fetchError.message,
      };
    } else if (!articlesToEnrich || articlesToEnrich.length === 0) {
      results.enrichment = {
        success: true,
        checked: 0,
        updated: 0,
        message: 'No articles need image enrichment',
      };
    } else {
      let updatedCount = 0;
      let failedCount = 0;

      for (const article of articlesToEnrich) {
        const { imageUrl, error } = await scrapeArticleImage(article.link);

        if (imageUrl) {
          const { error: updateError } = await supabase
            .from('articles')
            .update({ image_url: imageUrl })
            .eq('id', article.id);

          if (updateError) {
            console.error(`[/api/orchestrator] Failed to update image for ${article.id}:`, updateError);
            failedCount++;
          } else {
            updatedCount++;
          }
        } else {
          failedCount++;
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      results.enrichment = {
        success: true,
        checked: articlesToEnrich.length,
        updated: updatedCount,
        failed: failedCount,
      };

      console.log(
        `[/api/orchestrator] Task 2 Complete: ${updatedCount} images enriched, ${failedCount} failed`
      );
    }
  } catch (error) {
    console.error('[/api/orchestrator] Error during orchestration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Orchestration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        results,
      },
      { status: 500 }
    );
  }

  results.totalDurationMs = Date.now() - startTime;

  console.log(
    `[/api/orchestrator] All tasks completed in ${results.totalDurationMs}ms`
  );

  return NextResponse.json({
    success: true,
    message: 'Orchestration completed successfully',
    results,
  });
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
