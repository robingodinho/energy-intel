import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { revalidatePath } from 'next/cache';
import { runIngestion } from '@/lib/ingest';
import { getSupabase } from '@/lib/db';
import { scrapeArticleImage } from '@/lib/scrapeImage';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Allow longer background time; response returns immediately
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
 * Record job run to the job_runs table
 */
async function recordJobRun(record: JobRunRecord): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const supabase = getSupabase();
    
    // Use update instead of upsert to bypass potential RLS issues
    const { data: updateData, error: updateError } = await supabase
      .from('job_runs')
      .update({
        ran_at: record.ran_at,
        status: record.status,
        duration_ms: record.duration_ms,
        articles_inserted: record.articles_inserted,
        articles_updated: record.articles_updated,
        images_enriched: record.images_enriched,
        error_message: record.error_message,
        host: record.host,
        updated_at: new Date().toISOString(),
      })
      .eq('job_name', record.job_name)
      .select();
    
    if (updateError) {
      console.error('[orchestrator] Update error:', updateError.message);
      
      // If update failed (no row exists), try insert
      const { data: insertData, error: insertError } = await supabase
        .from('job_runs')
        .insert({
          job_name: record.job_name,
          ran_at: record.ran_at,
          status: record.status,
          duration_ms: record.duration_ms,
          articles_inserted: record.articles_inserted,
          articles_updated: record.articles_updated,
          images_enriched: record.images_enriched,
          error_message: record.error_message,
          host: record.host,
        })
        .select();
      
      if (insertError) {
        console.error('[orchestrator] Insert error:', insertError.message);
        return { success: false, error: insertError.message };
      }
      return { success: true, data: insertData };
    }
    
    if (!updateData || updateData.length === 0) {
      console.log('[orchestrator] Update returned no rows - trying insert');
      const { data: insertData, error: insertError } = await supabase
        .from('job_runs')
        .insert({
          job_name: record.job_name,
          ran_at: record.ran_at,
          status: record.status,
          duration_ms: record.duration_ms,
          articles_inserted: record.articles_inserted,
          articles_updated: record.articles_updated,
          images_enriched: record.images_enriched,
          error_message: record.error_message,
          host: record.host,
        })
        .select();
      
      if (insertError) {
        console.error('[orchestrator] Insert error:', insertError.message);
        return { success: false, error: insertError.message };
      }
      return { success: true, data: insertData };
    }
    
    console.log('[orchestrator] Job recorded:', updateData);
    return { success: true, data: updateData };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[orchestrator] Exception:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Run the orchestrated tasks in the background.
 * This can take several minutes; the HTTP response returns immediately.
 */
async function runOrchestratorTasks(ranAt: string, host: string) {
  const startTime = Date.now();

  let articlesInserted = 0;
  let articlesDuplicates = 0;
  let imagesEnriched = 0;

  try {
    // TASK 1: Ingestion
    console.log('[orchestrator] Task 1: Ingestion...');
    const ingestionStats = await runIngestion();
    articlesInserted = ingestionStats.totalItemsInserted;
    articlesDuplicates = ingestionStats.totalItemsDuplicates;
    console.log(`[orchestrator] Ingestion done: ${articlesInserted} new`);

    // TASK 2: Image enrichment (process a few each run)
    console.log('[orchestrator] Task 2: Image enrichment...');
    const supabase = getSupabase();
    const { data: articles } = await supabase
      .from('articles')
      .select('id, link')
      .is('image_url', null)
      .order('pub_date', { ascending: false })
      .limit(15);

    if (articles) {
      for (const article of articles) {
        const { imageUrl } = await scrapeArticleImage(article.link);
        if (imageUrl) {
          await supabase.from('articles').update({ image_url: imageUrl }).eq('id', article.id);
          imagesEnriched++;
        }
        // small delay to be polite
        await new Promise(res => setTimeout(res, 200));
      }
    }

    // TASK 3: Archive old finance articles
    console.log('[orchestrator] Task 3: Archiving finance articles...');
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
          const toArchive = allFinance.filter(a => !keepIds.has(a.id));
          for (const article of toArchive) {
            await supabase.from('articles').update({ is_archived: true }).eq('id', article.id);
          }
        }
      }
    } catch (e) {
      console.error('[orchestrator] Archive error (non-fatal):', e);
    }

    // TASK 4: Revalidate cache
    console.log('[orchestrator] Task 4: Revalidating cache...');
    try {
      revalidatePath('/');
      revalidatePath('/about');
      revalidatePath('/finance');
    } catch (e) {
      console.error('[orchestrator] Revalidate error (non-fatal):', e);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[orchestrator] SUCCESS in ${durationMs}ms`);

    await recordJobRun({
      job_name: 'orchestrator',
      ran_at: ranAt,
      status: 'success',
      duration_ms: durationMs,
      articles_inserted: articlesInserted,
      articles_updated: articlesDuplicates,
      images_enriched: imagesEnriched,
      error_message: null,
      host,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const durationMs = Date.now() - startTime;
    console.error('[orchestrator] ERROR:', errorMessage);

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
 * Orchestrator endpoint - returns immediately, work continues in background.
 */
export async function GET(request: NextRequest) {
  const ranAt = new Date().toISOString();
  const host = request.headers.get('host') || 'unknown';

  console.log(`[orchestrator] CRON HIT: ${ranAt} from ${host}`);

  // Validate cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isVercelCron = authHeader === `Bearer ${expectedSecret}`;

  if (cronSecret !== expectedSecret && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Kick off background work
  waitUntil(runOrchestratorTasks(ranAt, host));

  // Respond immediately to satisfy cron-job.org timeout
  return NextResponse.json({
    ok: true,
    message: 'Job started. Check /api/job-status for results.',
    startedAt: ranAt,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
