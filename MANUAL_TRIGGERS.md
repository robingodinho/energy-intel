# Manual Trigger Instructions

Since cron jobs are disabled, you can manually trigger the data updates using these methods:

## API Endpoints

### 1. Orchestrator (Runs both ingestion and image enrichment)
- **Endpoint**: `/api/orchestrator`
- **What it does**: 
  - Fetches new articles from RSS feeds
  - Generates AI summaries
  - Enriches articles with images
  - Revalidates UI cache so changes appear immediately
  - Records run to `job_runs` table for heartbeat tracking

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

### Option 4: Debug Mode (Extended Response)
Add `?debug=1` to get detailed proof-of-work in the response:
```powershell
$headers = @{"x-cron-secret" = "YOUR_CRON_SECRET"}
Invoke-RestMethod -Uri "https://enerva.ai/api/orchestrator?debug=1" -Headers $headers
```

Response includes: `ranAt`, `host`, `inserted`, `duplicates`, `imagesEnriched`, `latestArticleTimestamp`, `durationMs`

### Option 5: Check Job Status (Verify Cron is Working)
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

### UI Not Updating After Cron Run
1. The orchestrator now calls `revalidatePath('/')` after completing
2. Hard refresh your browser (Ctrl+Shift+R)
3. Check if new articles exist: visit `/api/job-status` to see `articles_inserted` count

### Cron-job.org Shows Success But No New Articles
1. Check `/api/job-status` to see if the job actually ran
2. If `articles_inserted: 0`, there might be no new articles in the RSS feeds
3. Check `duplicates` count - high number means feeds have same articles

### Vercel Logs Don't Show Requests
- Vercel free tier only shows logs from the last hour
- Use `/api/job-status` endpoint instead - it's free!
- The `job_runs` table is your permanent audit log

## Security Note
Always include the `x-cron-secret` header with your CRON_SECRET value to protect these endpoints from unauthorized access.
