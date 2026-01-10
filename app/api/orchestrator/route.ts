import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { revalidatePath } from 'next/cache';
import { runIngestion } from '@/lib/ingest';
import { getSupabase } from '@/lib/db';
import { scrapeArticleImage } from '@/lib/scrapeImage';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allow up to 300 seconds for background processing
export const maxDuration = 300;

/**
 * Job run record for heartbeat tracking
 */
interface JobRunRecord {
  job_name: string;
  ran_at: string;
  status: 'success' | 'error' | 'started';
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
 * Run all orchestrator tasks (ingestion, image enrichment, archiving, revalidation)
 * This runs in the background after the response is sent.
 */
async function runOrchestratorTasks(ranAt: string, host: string): Promise<void> {
  const startTime = Date.now();
  console.log('[orchestrator] Starting orchestrated tasks...');

  // Track results for proof of work
  let articlesInserted = 0;
  let articlesDuplicates = 0;
  let imagesEnriched = 0;
  let imagesFailed = 0;

  try {
    // ========================================
    // TASK 1: Run Ingestion
    // ========================================
    console.log('[orchestrator] Task 1: Starting ingestion...');
    
    const ingestionStats = await runIngestion();
    articlesInserted = ingestionStats.totalItemsInserted;
    articlesDuplicates = ingestionStats.totalItemsDuplicates;
    
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
    } else if (!articlesToEnrich || articlesToEnrich.length === 0) {
      console.log('[orchestrator] No articles need image enrichment');
    } else {
      for (const article of articlesToEnrich) {
        const { imageUrl } = await scrapeArticleImage(article.link);

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
      const supabaseForArchive = getSupabase();
      
      // Get the 6 most recent finance article IDs (these should stay active)
      const { data: recentFinanceArticles, error: recentError } = await supabaseForArchive
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
        const { data: allFinanceArticles, error: allError } = await supabaseForArchive
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
              const { error: archiveError } = await supabaseForArchive
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
    console.log('[orchestrator] Task 4: Revalidating UI cache...');
    try {
      revalidatePath('/');
      revalidatePath('/about');
      revalidatePath('/finance');
      console.log('[orchestrator] UI cache revalidated for /, /about, and /finance');
    } catch (revalidateError) {
      console.error('[orchestrator] Revalidation error (non-fatal):', revalidateError);
    }

    const totalDurationMs = Date.now() - startTime;

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

  } catch (error) {
    console.error('[orchestrator] Error during orchestration:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const durationMs = Date.now() - startTime;

    // Record the failed job run
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
  }
}

/**
 * Orchestrator endpoint that runs both ingestion and image enrichment sequentially
 * 
 * This combines multiple tasks into a single cron job:
 * 1. Ingest new articles from RSS feeds (with AI summarization)
 * 2. Enrich articles with missing images
 * 3. Archive old finance articles
 * 4. Revalidate UI cache
 * 
 * Security: Protected by CRON_SECRET
 * 
 * IMPORTANT: This endpoint returns immediately (within seconds) to satisfy
 * cron-job.org's 30-second timeout. The actual work runs in the background
 * using Vercel's waitUntil() function.
 * 
 * Check /api/job-status to verify the job completed successfully.
 */
export async function GET(request: NextRequest) {
  const ranAt = new Date().toISOString();
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'unknown';
  
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

  // Record that the job has started
  await recordJobRun({
    job_name: 'orchestrator',
    ran_at: ranAt,
    status: 'started',
    duration_ms: 0,
    articles_inserted: 0,
    articles_updated: 0,
    images_enriched: 0,
    error_message: null,
    host,
  });

  // Schedule the background work using waitUntil
  // This allows us to return immediately while processing continues
  waitUntil(runOrchestratorTasks(ranAt, host));

  // Return immediately - cron-job.org will see this as success
  // The actual work continues in the background
  return NextResponse.json({
    ok: true,
    message: 'Job started. Check /api/job-status for completion status.',
    startedAt: ranAt,
  });
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
