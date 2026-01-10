# Manual Trigger Instructions

Since cron jobs are disabled, you can manually trigger the data updates using these methods:

## API Endpoints

### 1. Orchestrator (Runs both ingestion and image enrichment)
- **Endpoint**: `/api/orchestrator`
- **Behavior**: Returns immediately (within seconds), processes in background
- **What it does**: 
  - Fetches new articles from RSS feeds
  - Generates AI summaries
  - Enriches articles with images
  - Archives old finance articles
  - Revalidates UI cache so changes appear immediately
  - Records run to `job_runs` table for heartbeat tracking
- **Status tracking**: The job records status as `started` → `success` or `error`

### 2. Job Status (Check if cron is working)
- **Endpoint**: `/api/job-status`
- **What it does**: Returns the most recent job run from the `job_runs` table
- **Use case**: Verify cron-job.org is successfully calling your endpoint without needing Vercel paid logs

### 3. Individual Endpoints (if you want to run tasks separately)
- **Ingestion**: `/api/ingest` - Fetches and summarizes new articles
- **Image Enrichment**: `/api/enrich-images` - Adds cover images to articles
- **Re-categorization**: `/api/recategorize` - Updates article categories
- **Re-summarization**: `/api/resummarize` - Regenerates AI summaries

## How to Trigger Manually

### Option 1: Using Browser (for testing)
Add your CRON_SECRET as a header using a browser extension like ModHeader, then visit:
- `https://enerva.ai/api/orchestrator`

### Option 2: Using cURL
```bash
curl -X GET https://enerva.ai/api/orchestrator \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Option 3: Using PowerShell
```powershell
$headers = @{"x-cron-secret" = "YOUR_CRON_SECRET"}
Invoke-RestMethod -Uri "https://enerva.ai/api/orchestrator" -Headers $headers
```

### Option 4: Check Job Status (Verify Cron is Working)
```powershell
$headers = @{"x-cron-secret" = "YOUR_CRON_SECRET"}
Invoke-RestMethod -Uri "https://enerva.ai/api/job-status" -Headers $headers
```

This returns the most recent job run, including when it ran and what it did.

## External Cron Service (cron-job.org)

### Setup
1. Create account at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL**: `https://enerva.ai/api/orchestrator`
   - **Schedule**: Every 6 hours
   - **Header**: `x-cron-secret: YOUR_CRON_SECRET`

### Verifying It Works
1. **Check cron-job.org dashboard**: Should show "Successful (200 OK)"
2. **Check job_runs table**: Use `/api/job-status` endpoint or Supabase dashboard
3. **Check the website**: Visit https://enerva.ai and look for new articles

## Database Heartbeat Table

The `job_runs` table tracks every cron run. To set it up:

1. Go to Supabase Dashboard → SQL Editor
2. Run the migration: `migrations/002_add_job_runs.sql`

### Query Job Runs (Supabase Dashboard)
```sql
SELECT * FROM job_runs ORDER BY ran_at DESC;
```

## Troubleshooting

### Understanding the Async Behavior
The orchestrator returns immediately (200 OK) and processes in the background. This is required because cron-job.org has a 30-second timeout, but the full job takes 1-5 minutes.

- **Status `started`**: Job was triggered and is currently running
- **Status `success`**: Job completed successfully
- **Status `error`**: Job failed (check `error_message` field)

**Important**: Wait 2-5 minutes after cron-job.org shows success, then check `/api/job-status` to verify the job actually completed.

### UI Not Updating After Cron Run
1. Wait 2-5 minutes for the background job to complete
2. Check `/api/job-status` - status should be `success` (not `started`)
3. Hard refresh your browser (Ctrl+Shift+R)
4. Check if new articles exist: visit `/api/job-status` to see `articles_inserted` count

### Cron-job.org Shows Success But No New Articles
1. Check `/api/job-status` to see if the job actually completed (status = `success`)
2. If status is `started`, wait a few more minutes
3. If `articles_inserted: 0`, there might be no new articles in the RSS feeds
4. Check `duplicates` count - high number means feeds have same articles

### Vercel Logs Don't Show Requests
- Vercel free tier only shows logs from the last hour
- Use `/api/job-status` endpoint instead - it's free!
- The `job_runs` table is your permanent audit log

## Security Note
Always include the `x-cron-secret` header with your CRON_SECRET value to protect these endpoints from unauthorized access.
