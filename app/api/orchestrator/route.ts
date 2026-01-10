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
  status: 'success' | 'error';
  duration_ms: number;
  articles_inserted: number;
  articles_updated: number;
  images_enriched: number;
  error_message: string | null;
  host: string | null;
}

/**
 * Record job run to the job_runs table for heartbeat tracking.
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
      console.error('[orchestrator] Failed to record job run:', error.message);
    } else {
      console.log('[orchestrator] Job run recorded successfully');
    }
  } catch (err) {
    console.error('[orchestrator] Error recording job run:', err);
  }
}

/**
 * Run all orchestrator tasks in the background
 */
async function runOrchestratorTasks(ranAt: string, host: string): Promise<void> {
  const startTime = Date.now();
  console.log('[orchestrator] Background tasks starting...');

  let articlesInserted = 0;
  let articlesDuplicates = 0;
  let imagesEnriched = 0;
  let imagesFailed = 0;

  try {
    // TASK 1: Run Ingestion
    console.log('[orchestrator] Task 1: Starting ingestion...');
    const ingestionStats = await runIngestion();
    articlesInserted = ingestionStats.totalItemsInserted;
    articlesDuplicates = ingestionStats.totalItemsDuplicates;
    console.log(`[orchestrator] Task 1 Complete: ${articlesInserted} new, ${articlesDuplicates} duplicates`);

    // TASK 2: Enrich Images
    console.log('[orchestrator] Task 2: Starting image enrichment...');
    const supabase = getSupabase();

    const { data: articlesToEnrich, error: fetchError } = await supabase
      .from('articles')
      .select('id, link, source, title')
      .is('image_url', null)
      .order('pub_date', { ascending: false })
      .limit(15);

    if (fetchError) {
      console.error('[orchestrator] Error fetching articles:', fetchError);
    } else if (articlesToEnrich && articlesToEnrich.length > 0) {
      for (const article of articlesToEnrich) {
        const { imageUrl } = await scrapeArticleImage(article.link);
        if (imageUrl) {
          const { error: updateError } = await supabase
            .from('articles')
            .update({ image_url: imageUrl })
            .eq('id', article.id);
          if (!updateError) {
            imagesEnriched++;
          } else {
            imagesFailed++;
          }
        } else {
          imagesFailed++;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      console.log(`[orchestrator] Task 2 Complete: ${imagesEnriched} enriched, ${imagesFailed} failed`);
    } else {
      console.log('[orchestrator] Task 2: No articles need images');
    }

    // TASK 3: Archive old finance articles (keep 6 most recent)
    console.log('[orchestrator] Task 3: Archiving old finance articles...');
    let financeArchived = 0;
    try {
      const { data: recentFinance } = await supabase
        .from('articles')
        .select('id')
        .eq('article_type', 'finance')
        .eq('is_archived', false)
        .order('pub_date', { ascending: false })
        .limit(6);

      if (recentFinance && recentFinance.length > 0) {
        const keepIds = new Set(recentFinance.map(a => a.id));
        
        const { data: allFinance } = await supabase
          .from('articles')
          .select('id')
          .eq('article_type', 'finance')
          .eq('is_archived', false);

        if (allFinance) {
          const idsToArchive = allFinance.filter(a => !keepIds.has(a.id)).map(a => a.id);
          for (const id of idsToArchive) {
            await supabase.from('articles').update({ is_archived: true }).eq('id', id);
            financeArchived++;
          }
        }
      }
      console.log(`[orchestrator] Task 3 Complete: ${financeArchived} archived`);
    } catch (e) {
      console.error('[orchestrator] Archive error (non-fatal):', e);
    }

    // TASK 4: Revalidate UI cache
    console.log('[orchestrator] Task 4: Revalidating cache...');
    try {
      revalidatePath('/');
      revalidatePath('/about');
      revalidatePath('/finance');
      console.log('[orchestrator] Task 4 Complete: Cache revalidated');
    } catch (e) {
      console.error('[orchestrator] Revalidate error (non-fatal):', e);
    }

    // Record success
    const totalDurationMs = Date.now() - startTime;
    console.log(`[orchestrator] ALL TASKS COMPLETE in ${totalDurationMs}ms`);

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const durationMs = Date.now() - startTime;
    console.error(`[orchestrator] FATAL ERROR: ${errorMessage}`);

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
  }
}

/**
 * Orchestrator endpoint
 * 
 * Returns immediately with 200 OK, then processes in background.
 * This is compatible with cron-job.org's 30-second timeout.
 * 
 * Check /api/job-status to verify the job completed.
 */
export async function GET(request: NextRequest) {
  const ranAt = new Date().toISOString();
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'unknown';
  
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
    console.log(`AUTH FAILED: ${ranAt}`);
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing cron secret' },
      { status: 401 }
    );
  }

  // Schedule background work - this continues after response is sent
  waitUntil(runOrchestratorTasks(ranAt, host));

  // Return immediately to satisfy cron-job.org's 30-second timeout
  return NextResponse.json({
    ok: true,
    message: 'Job started. Check /api/job-status for results.',
    startedAt: ranAt,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
