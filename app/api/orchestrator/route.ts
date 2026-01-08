import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runIngestion } from '@/lib/ingest';
import { getSupabase } from '@/lib/db';
import { scrapeArticleImage } from '@/lib/scrapeImage';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allow up to 300 seconds for both tasks
export const maxDuration = 300;

/**
 * Job run record for heartbeat tracking
 */
interface JobRunRecord {
  job_name: string;
  ran_at: string;
  status: 'success' | 'error';
  duration_ms: number;
  articles_inserted: number;
  articles_updated: number;
  images_enriched: number;
  error_message: string | null;
  host: string | null;
}

/**
 * Upsert a job run record to the job_runs table for heartbeat tracking.
 * This allows verifying cron runs without Vercel paid logs.
 */
async function recordJobRun(record: JobRunRecord): Promise<void> {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('job_runs')
      .upsert({
        job_name: record.job_name,
        ran_at: record.ran_at,
        status: record.status,
        duration_ms: record.duration_ms,
        articles_inserted: record.articles_inserted,
        articles_updated: record.articles_updated,
        images_enriched: record.images_enriched,
        error_message: record.error_message,
        host: record.host,
      }, {
        onConflict: 'job_name',
      });

    if (error) {
      // Log but don't fail the job if heartbeat recording fails
      console.error('[orchestrator] Failed to record job run:', error.message);
    } else {
      console.log('[orchestrator] Job run recorded to job_runs table');
    }
  } catch (err) {
    console.error('[orchestrator] Error recording job run:', err);
  }
}

/**
 * Get the latest article timestamp from the database
 */
async function getLatestArticleTimestamp(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('articles')
      .select('pub_date')
      .order('pub_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.pub_date;
  } catch {
    return null;
  }
}

/**
 * Orchestrator endpoint that runs both ingestion and image enrichment sequentially
 * 
 * This combines two tasks into a single cron job:
 * 1. Ingest new articles from RSS feeds (with AI summarization)
 * 2. Enrich articles with missing images
 * 
 * Security: Protected by CRON_SECRET
 * 
 * Query params:
 * - debug=1: Return extended JSON with full proof-of-work details
 */
export async function GET(request: NextRequest) {
  const ranAt = new Date().toISOString();
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'unknown';
  const debugMode = request.nextUrl.searchParams.get('debug') === '1';
  
  // === PROOF OF WORK: Log cron hit immediately ===
  console.log('========================================');
  console.log(`CRON HIT: ${ranAt}`);
  console.log(`HOST: ${host}`);
  console.log('========================================');

  // Validate cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isVercelCron = authHeader === `Bearer ${expectedSecret}`;

  if (cronSecret !== expectedSecret && !isVercelCron) {
    console.log(`CRON AUTH FAILED: ${ranAt} - Invalid secret`);
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing cron secret' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  console.log('[orchestrator] Starting orchestrated tasks...');

  // Track results for proof of work
  let articlesInserted = 0;
  let articlesDuplicates = 0;
  let imagesEnriched = 0;
  let imagesFailed = 0;
  let errorMessage: string | null = null;

  const results = {
    ingestion: null as any,
    enrichment: null as any,
    totalDurationMs: 0,
  };

  try {
    // ========================================
    // TASK 1: Run Ingestion
    // ========================================
    console.log('[orchestrator] Task 1: Starting ingestion...');
    
    const ingestionStats = await runIngestion();
    articlesInserted = ingestionStats.totalItemsInserted;
    articlesDuplicates = ingestionStats.totalItemsDuplicates;
    
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
      `[orchestrator] Task 1 Complete: ${ingestionStats.totalItemsInserted} new articles ingested`
    );

    // ========================================
    // TASK 2: Enrich Images
    // ========================================
    console.log('[orchestrator] Task 2: Starting image enrichment...');
    
    const supabase = getSupabase();
    const limit = 15; // Process 15 articles per run

    const { data: articlesToEnrich, error: fetchError } = await supabase
      .from('articles')
      .select('id, link, source, title')
      .is('image_url', null)
      .order('pub_date', { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error('[orchestrator] Error fetching articles for enrichment:', fetchError);
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
      for (const article of articlesToEnrich) {
        const { imageUrl, error } = await scrapeArticleImage(article.link);

        if (imageUrl) {
          const { error: updateError } = await supabase
            .from('articles')
            .update({ image_url: imageUrl })
            .eq('id', article.id);

          if (updateError) {
            console.error(`[orchestrator] Failed to update image for ${article.id}:`, updateError);
            imagesFailed++;
          } else {
            imagesEnriched++;
          }
        } else {
          imagesFailed++;
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      results.enrichment = {
        success: true,
        checked: articlesToEnrich.length,
        updated: imagesEnriched,
        failed: imagesFailed,
      };

      console.log(
        `[orchestrator] Task 2 Complete: ${imagesEnriched} images enriched, ${imagesFailed} failed`
      );
    }

    // ========================================
    // TASK 3: Archive old finance articles (keep only 6 most recent)
    // ========================================
    console.log('[orchestrator] Task 3: Archiving old finance articles...');
    let financeArchived = 0;
    try {
      // Get the 6 most recent finance article IDs (these should stay active)
      const { data: recentFinanceArticles, error: recentError } = await supabase
        .from('articles')
        .select('id')
        .eq('article_type', 'finance')
        .eq('is_archived', false)
        .order('pub_date', { ascending: false })
        .limit(6);

      if (recentError) {
        console.error('[orchestrator] Error fetching recent finance articles:', recentError);
      } else if (recentFinanceArticles && recentFinanceArticles.length > 0) {
        const keepIds = new Set(recentFinanceArticles.map(a => a.id));
        
        // Get ALL non-archived finance articles to find ones to archive
        const { data: allFinanceArticles, error: allError } = await supabase
          .from('articles')
          .select('id')
          .eq('article_type', 'finance')
          .eq('is_archived', false);

        if (allError) {
          console.error('[orchestrator] Error fetching all finance articles:', allError);
        } else if (allFinanceArticles) {
          // Find IDs that are NOT in the top 6
          const idsToArchive = allFinanceArticles
            .filter(a => !keepIds.has(a.id))
            .map(a => a.id);

          if (idsToArchive.length > 0) {
            // Archive each article individually (more reliable)
            for (const id of idsToArchive) {
              const { error: archiveError } = await supabase
                .from('articles')
                .update({ is_archived: true })
                .eq('id', id);

              if (archiveError) {
                console.error(`[orchestrator] Error archiving article ${id}:`, archiveError);
              } else {
                financeArchived++;
              }
            }
            console.log(`[orchestrator] Task 3 Complete: ${financeArchived} finance articles archived`);
          } else {
            console.log('[orchestrator] Task 3 Complete: No finance articles needed archiving');
          }
        }
      }
    } catch (archiveErr) {
      console.error('[orchestrator] Finance archive error (non-fatal):', archiveErr);
    }

    // ========================================
    // TASK 4: Revalidate UI cache
    // ========================================
    // This ensures the homepage shows fresh data after ingestion.
    // Without this, Next.js might serve stale cached pages even with force-dynamic
    // because of edge/CDN caching or full route cache.
    console.log('[orchestrator] Task 4: Revalidating UI cache...');
    try {
      revalidatePath('/');
      revalidatePath('/about');
      revalidatePath('/finance');
      console.log('[orchestrator] UI cache revalidated for /, /about, and /finance');
    } catch (revalidateError) {
      console.error('[orchestrator] Revalidation error (non-fatal):', revalidateError);
    }

  } catch (error) {
    console.error('[orchestrator] Error during orchestration:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Record the failed job run
    const durationMs = Date.now() - startTime;
    await recordJobRun({
      job_name: 'orchestrator',
      ran_at: ranAt,
      status: 'error',
      duration_ms: durationMs,
      articles_inserted: articlesInserted,
      articles_updated: articlesDuplicates,
      images_enriched: imagesEnriched,
      error_message: errorMessage,
      host,
    });

    // === PROOF OF WORK: Log job failure ===
    console.log('========================================');
    console.log(`JOB FAILED: ${new Date().toISOString()}`);
    console.log(`ERROR: ${errorMessage}`);
    console.log(`DURATION: ${durationMs}ms`);
    console.log('========================================');

    return NextResponse.json(
      {
        ok: false,
        error: 'Orchestration failed',
        details: errorMessage,
        results,
      },
      { status: 500 }
    );
  }

  const totalDurationMs = Date.now() - startTime;
  results.totalDurationMs = totalDurationMs;

  // === PROOF OF WORK: Log job success ===
  console.log('========================================');
  console.log(`JOB RESULT: ${new Date().toISOString()}`);
  console.log(`STATUS: SUCCESS`);
  console.log(`INSERTED: ${articlesInserted}`);
  console.log(`DUPLICATES: ${articlesDuplicates}`);
  console.log(`IMAGES_ENRICHED: ${imagesEnriched}`);
  console.log(`IMAGES_FAILED: ${imagesFailed}`);
  console.log(`DURATION: ${totalDurationMs}ms`);
  console.log(`HOST: ${host}`);
  console.log('========================================');

  // Record successful job run to heartbeat table
  await recordJobRun({
    job_name: 'orchestrator',
    ran_at: ranAt,
    status: 'success',
    duration_ms: totalDurationMs,
    articles_inserted: articlesInserted,
    articles_updated: articlesDuplicates,
    images_enriched: imagesEnriched,
    error_message: null,
    host,
  });

  // Get latest article timestamp for debug response
  const latestArticleTimestamp = debugMode ? await getLatestArticleTimestamp() : null;

  // === Response based on debug mode ===
  if (debugMode) {
    // Extended response for debugging (only when debug=1)
    return NextResponse.json({
      ok: true,
      ranAt,
      host,
      inserted: articlesInserted,
      duplicates: articlesDuplicates,
      imagesEnriched,
      imagesFailed,
      latestArticleTimestamp,
      durationMs: totalDurationMs,
      results,
    });
  }

  // Minimal response for normal operation
  return NextResponse.json({
    ok: true,
  });
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
