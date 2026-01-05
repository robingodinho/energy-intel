# Manual Trigger Instructions

Since cron jobs are disabled, you can manually trigger the data updates using these methods:

## API Endpoints

### 1. Orchestrator (Runs both ingestion and image enrichment)
- **Endpoint**: `/api/orchestrator`
- **What it does**: 
  - Fetches new articles from RSS feeds
  - Generates AI summaries
  - Enriches articles with images

### 2. Individual Endpoints (if you want to run tasks separately)
- **Ingestion**: `/api/ingest` - Fetches and summarizes new articles
- **Image Enrichment**: `/api/enrich-images` - Adds cover images to articles
- **Re-categorization**: `/api/recategorize` - Updates article categories
- **Re-summarization**: `/api/resummarize` - Regenerates AI summaries

## How to Trigger Manually

### Option 1: Using Browser (for testing)
Add your CRON_SECRET as a header using a browser extension like ModHeader, then visit:
- `https://your-app.vercel.app/api/orchestrator`

### Option 2: Using cURL
```bash
curl -X GET https://your-app.vercel.app/api/orchestrator \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Option 3: Using PowerShell
```powershell
$headers = @{"x-cron-secret" = "YOUR_CRON_SECRET"}
Invoke-RestMethod -Uri "https://your-app.vercel.app/api/orchestrator" -Headers $headers
```

### Option 4: Create a Simple Admin Page
You could create a protected admin page with buttons to trigger these endpoints.

### Option 5: Use External Cron Services (Free)
- **Cron-job.org**: Free cron job service
- **UptimeRobot**: Can call your endpoints on schedule
- **GitHub Actions**: Can trigger your endpoints on schedule

## Recommended Schedule
Run the orchestrator endpoint:
- **Every 6 hours** for regular updates
- **Or daily** if you want less frequent updates

## Security Note
Always include the `x-cron-secret` header with your CRON_SECRET value to protect these endpoints from unauthorized access.
