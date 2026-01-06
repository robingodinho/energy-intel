import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/job-status
 * 
 * Returns the most recent job run record from the job_runs table.
 * This allows you to verify cron jobs are running without Vercel paid logs.
 * 
 * Security: Protected by CRON_SECRET header
 * 
 * Example response:
 * {
 *   "ok": true,
 *   "jobRun": {
 *     "job_name": "orchestrator",
 *     "ran_at": "2026-01-07T06:00:03.000Z",
 *     "status": "success",
 *     "duration_ms": 1888,
 *     "articles_inserted": 5,
 *     "articles_updated": 42,
 *     "images_enriched": 3,
 *     "error_message": null,
 *     "host": "energy-intel.org"
 *   },
 *   "timeSinceLastRun": "2 hours ago"
 * }
 */
export async function GET(request: NextRequest) {
  // Validate cron secret for security
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (cronSecret !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing cron secret' },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabase();

    // Get the most recent job run for 'orchestrator'
    const { data: jobRun, error } = await supabase
      .from('job_runs')
      .select('*')
      .eq('job_name', 'orchestrator')
      .single();

    if (error) {
      // PGRST116 means no rows found - table might be empty or job hasn't run yet
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          ok: true,
          jobRun: null,
          message: 'No job runs recorded yet. Run the orchestrator first.',
        });
      }

      // Check if table doesn't exist
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        return NextResponse.json({
          ok: false,
          error: 'job_runs table does not exist. Please run the SQL migration first.',
          migrationFile: 'migrations/002_add_job_runs.sql',
        }, { status: 500 });
      }

      throw error;
    }

    // Calculate time since last run
    const timeSinceLastRun = jobRun?.ran_at 
      ? formatTimeSince(new Date(jobRun.ran_at))
      : null;

    return NextResponse.json({
      ok: true,
      jobRun,
      timeSinceLastRun,
    });
  } catch (err) {
    console.error('[job-status] Error:', err);
    return NextResponse.json(
      { 
        ok: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * Format time since a given date in human-readable format
 */
function formatTimeSince(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  return 'Just now';
}

