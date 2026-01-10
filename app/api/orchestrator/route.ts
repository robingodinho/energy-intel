import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runIngestion } from '@/lib/ingest';
import { getSupabase } from '@/lib/db';
import { scrapeArticleImage } from '@/lib/scrapeImage';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max (Vercel hobby limit)

// Time limit for the job - leave buffer for response
const JOB_TIME_LIMIT_MS = 25000; // 25 seconds

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
async function recordJobRun(record: JobRunRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('job_runs').upsert({
      job_name: record.job_name,
      ran_at: record.ran_at,
      status: record.status,
      duration_ms: record.duration_ms,
      articles_inserted: record.articles_inserted,
      articles_updated: record.articles_updated,
      images_enriched: record.images_enriched,
      error_message: record.error_message,
      host: record.host,
    }, { onConflict: 'job_name' });
    
    if (error) {
      console.error('[orchestrator] Supabase error:', error.message, error.details, error.hint);
      return { success: false, error: error.message };
    }
    console.log('[orchestrator] Job recorded successfully');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[orchestrator] Exception recording job:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Check if we should stop due to time limit
 */
function isTimeLimitExceeded(startTime: number): boolean {
  return Date.now() - startTime > JOB_TIME_LIMIT_MS;
}

/**
 * Orchestrator endpoint - runs synchronously with time limits
 */
export async function GET(request: NextRequest) {
  const ranAt = new Date().toISOString();
  const startTime = Date.now();
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

  let articlesInserted = 0;
  let articlesDuplicates = 0;
  let imagesEnriched = 0;
  let tasksCompleted: string[] = [];

  try {
    // TASK 1: Run Ingestion (this is the core task)
    console.log('[orchestrator] Task 1: Ingestion...');
    const ingestionStats = await runIngestion();
    articlesInserted = ingestionStats.totalItemsInserted;
    articlesDuplicates = ingestionStats.totalItemsDuplicates;
    tasksCompleted.push('ingestion');
    console.log(`[orchestrator] Ingestion done: ${articlesInserted} new`);

    // TASK 2: Enrich a few images (if time permits)
    if (!isTimeLimitExceeded(startTime)) {
      console.log('[orchestrator] Task 2: Image enrichment...');
      const supabase = getSupabase();
      
      // Only process 3 images to stay within time limit
      const { data: articles } = await supabase
        .from('articles')
        .select('id, link')
        .is('image_url', null)
        .order('pub_date', { ascending: false })
        .limit(3);

      if (articles) {
        for (const article of articles) {
          if (isTimeLimitExceeded(startTime)) break;
          
          const { imageUrl } = await scrapeArticleImage(article.link);
          if (imageUrl) {
            await supabase.from('articles').update({ image_url: imageUrl }).eq('id', article.id);
            imagesEnriched++;
          }
        }
      }
      tasksCompleted.push('images');
      console.log(`[orchestrator] Images done: ${imagesEnriched} enriched`);
    }

    // TASK 3: Archive old finance articles (if time permits)
    if (!isTimeLimitExceeded(startTime)) {
      console.log('[orchestrator] Task 3: Archiving...');
      const supabase = getSupabase();
      
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
            if (isTimeLimitExceeded(startTime)) break;
            await supabase.from('articles').update({ is_archived: true }).eq('id', article.id);
          }
        }
      }
      tasksCompleted.push('archive');
    }

    // TASK 4: Revalidate cache
    if (!isTimeLimitExceeded(startTime)) {
      try {
        revalidatePath('/');
        revalidatePath('/about');
        revalidatePath('/finance');
        tasksCompleted.push('revalidate');
      } catch (e) {
        console.error('[orchestrator] Revalidate error:', e);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[orchestrator] SUCCESS in ${durationMs}ms. Tasks: ${tasksCompleted.join(', ')}`);

    // Record success
    const dbResult = await recordJobRun({
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

    return NextResponse.json({
      ok: true,
      durationMs,
      articlesInserted,
      duplicates: articlesDuplicates,
      imagesEnriched,
      tasksCompleted,
      dbRecorded: dbResult.success,
      dbError: dbResult.error || null,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const durationMs = Date.now() - startTime;
    console.error(`[orchestrator] ERROR: ${errorMessage}`);

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

    return NextResponse.json({
      ok: false,
      error: errorMessage,
      durationMs,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
