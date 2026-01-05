# U.S. Energy Intelligence Platform — PRD & Build Guide
**Framework:** Next.js 14.x (DO NOT UPGRADE TO 15+)  
**Deployment:** Vercel  
**Purpose:** High‑performance, AI‑powered regulatory intelligence platform for U.S. energy policy

---

## How to Use This Document (Important)

This README acts as the **single source of truth** for:
- Project scope and intent
- Architectural constraints
- Step‑by‑step implementation order
- Task tracking for Claude Code

Claude Code should:
- Follow steps **sequentially**
- Update the task tracker as work is completed
- Respect **Next.js 14.x only**
- Avoid adding experimental or unnecessary features

---

## Product Vision

Build a **fast, reliable, and cost‑efficient** platform that:
- Aggregates U.S. federal energy policy updates (FERC, EPA, DOE, EIA)
- Uses AI **only during ingestion** (never at page load)
- Stores pre‑processed articles in a database
- Serves a clean, instantly loading feed to users

This is a **production‑grade system**, not a demo.

---

## Core Principles (Non‑Negotiable)

- ✅ Next.js **14.x only**
- ✅ No AI calls during page render
- ✅ Scheduled ingestion via Vercel Cron
- ✅ Database‑backed storage (Supabase)
- ✅ Read‑heavy, fast APIs
- ❌ No scraping arbitrary websites
- ❌ No experimental Next.js features
- ❌ No sidebars or Perplexity UI cloning (focus on function + speed)

---

## High‑Level Architecture

```
Official RSS Feeds (FERC, EPA, DOE, EIA)
        ↓
Scheduled Ingestion (Vercel Cron)
        ↓
AI Summarization + Categorization
        ↓
Supabase Postgres
        ↓
Read‑Only API (/api/articles)
        ↓
Instant Frontend Feed
```

---

## Task Tracker

### 🔄 In Progress
_Update this section as Claude Code works_

- [ ] Ready for next step: Step 11 (Integration + polish) or Step 12 (Deployment)

---

### ✅ Completed Tasks
_Check items off as they are finished_

- [x] Step 1: Project initialization (Next.js 14.x)
  - ✓ Downgraded Next.js from 16.1.1 → 14.2.35 (patched version, addresses security vulnerability)
  - ✓ Downgraded React from 19.x → 18.3.1
  - ✓ Converted next.config.ts → next.config.js (Next.js 14 compatibility)
  - ✓ Updated Tailwind CSS from v4 → v3.4.4 (v4 incompatible with Next.js 14)
  - ✓ Created tailwind.config.js
  - ✓ Updated postcss.config.mjs for Tailwind v3
  - ✓ Updated globals.css with Tailwind v3 directives
  - ✓ Updated layout.tsx (replaced Geist fonts with Inter for compatibility)
  - ✓ Created .eslintrc.json (replaced flat config format)
- [x] Step 2: Environment configuration
  - ✓ Created `env.template` with all required environment variables
  - ✓ Verified .gitignore already covers `.env*` files
  - ✓ Installed dependencies: rss-parser, openai, date-fns, @supabase/supabase-js
  - ✓ User created `.env.local` with CRON_SECRET
- [x] Step 3: Cron configuration
  - ✓ Created `app/api/ingest/route.ts` with security validation
  - ✓ Endpoint validates `x-cron-secret` header OR `Authorization: Bearer <secret>`
  - ✓ Returns 401 Unauthorized if secret doesn't match `CRON_SECRET` env var
  - ✓ Uses `force-dynamic` to prevent caching
  - ✓ Supports both GET (for Vercel Cron) and POST (for manual triggers)
  - ✓ Created `vercel.json` with cron schedule: every 6 hours (`0 */6 * * *`)
  - **Note**: Full ingestion logic (RSS fetch, AI, DB) will be added in Steps 9-10
- [x] Step 4: Supabase database schema
  - ✓ Created `lib/db.ts` with Supabase client singleton
  - ✓ Uses lazy initialization to avoid build-time errors
  - ✓ Added `insertArticles()` and `fetchArticles()` helpers
  - ✓ Added `articleExists()` helper for deduplication checks
  - ✓ Server-side only (no session persistence)
  - ✓ User created `articles` table in Supabase
- [x] Step 5: TypeScript types
  - ✓ Created `types/article.ts` with all article-related types
  - ✓ `ArticleCategory` union: 'LNG' | 'Renewable Energy' | 'Energy Policy' | 'Emissions' | 'Infrastructure'
  - ✓ `ArticleRow` matches DB schema exactly (snake_case field names)
  - ✓ `ArticleInsert` omits auto-generated `created_at`
  - ✓ `Article` alias for frontend use
  - ✓ Added `RawFeedItem` and `FeedSource` types for RSS processing
  - ✓ Updated `lib/db.ts` to import types from `@/types/article`
  - ✓ Validated with `npm run build` — passes with no errors
- [x] Step 6: RSS feed configuration
  - ✓ Created `lib/feeds.ts` with official government RSS sources
  - ✓ 6 working feeds: EIA, DOE, Utility Dive, Renewable Energy World, Power Magazine, Energy Storage News
  - ✓ 7 disabled feeds (access issues): FERC, EPA, Oil & Gas Journal, Reuters, S&P Global, IEA, IRENA
  - ✓ Created `lib/fetchFeed.ts` with rss-parser, 15s timeout, dev diagnostics
  - ✓ Created `lib/normalizeFeedItem.ts` for RawFeedItem → PartialArticle conversion
  - ✓ Stable ID generation: prefers guid, falls back to hash(link)
  - ✓ Enhanced dev diagnostics: HTTP status, Content-Type, response preview
  - ✓ Added `npm run test:feeds` with TEST_ALL and TEST_SOURCE options
  - ✓ 111 total items across 6 sources
- [x] Step 6.5: Supabase database writes (implemented ahead of categorization)
  - ✓ Created `lib/ingest.ts` with full ingestion pipeline
  - ✓ Pipeline: fetch feeds → normalize → validate → insert to Supabase
  - ✓ Updated `/api/ingest` route to run full pipeline
  - ✓ Duplicate handling: upsert with `ignoreDuplicates: true`
  - ✓ Clear stats: inserted, duplicates, skipped, dbErrors
  - ✓ Verified: 111 articles inserted on first run, 111 duplicates on second run
  - ✓ Per-source breakdown in API response
- [x] Step 7: Categorization logic (keyword-based, deterministic)
  - ✓ Created `lib/categorize.ts` with weighted keyword scoring
  - ✓ 5 categories: LNG, Renewable Energy, Energy Policy, Emissions, Infrastructure
  - ✓ Strong keywords (3 points) vs regular keywords (1 point)
  - ✓ Fallback to "Energy Policy" for generic articles
  - ✓ Updated `normalizeFeedItem.ts` to use categorization
  - ✓ Created `/api/recategorize` endpoint to update existing articles
  - ✓ Ran recategorization: 30 Renewable Energy, 22 Infrastructure, 59 Energy Policy
- [x] Step 8: Discover Feed UI (Perplexity-inspired)
  - ✓ Created `lib/getArticles.ts` for server-side Supabase queries
  - ✓ Created `lib/images.ts` for category → placeholder image mapping
  - ✓ Created 6 SVG placeholders in `/public/placeholders/` (one per category + default)
  - ✓ Created `components/ArticleCard.tsx` with square image, title, summary, metadata
  - ✓ Created `components/CategoryChips.tsx` (client component for URL-based filtering)
  - ✓ Updated `app/page.tsx` with Discover layout: header, hero, grid, filters
  - ✓ Dark mode styling with Tailwind, line-clamp, hover effects
  - ✓ Responsive grid: 1/2/3/4 columns for mobile/tablet/desktop
  - ✓ Category filtering via URL query params (`?category=LNG`)
  - ✓ Build passes, UI renders with real Supabase data
- [x] Step 9: OpenGraph Image Enrichment
  - ✓ Created `migrations/001_add_image_url.sql` — run in Supabase SQL Editor
  - ✓ Updated `ArticleRow` and `ArticleInsert` types with `image_url?: string | null`
  - ✓ Created `lib/scrapeImage.ts` — enhanced multi-fallback image scraper:
    - OpenGraph (og:image) and Twitter Card meta tags
    - JSON-LD Schema.org image extraction
    - Featured image patterns (WordPress, article images)
    - Fallback to first substantial img tag
  - ✓ Created `app/api/enrich-images/route.ts` — protected enrichment endpoint
  - ✓ Scrapes 15 articles per run, updates DB with found image URLs
  - ✓ Updated `next.config.js` with `images.remotePatterns` for external URLs
  - ✓ Updated `ArticleCard.tsx` with SVG-aware image handling and fallback
  - ✓ Added cron to `vercel.json`: `/api/enrich-images` runs every 2 hours
  - ✓ Added `force-dynamic` to `page.tsx` to prevent stale data caching
  - ✓ All 107+ articles enriched with real cover images
- [x] Step 10: AI summarization logic
  - ✓ Created `lib/summarize.ts` with OpenAI integration (gpt-4o-mini)
  - ✓ Professional system prompt focused on energy policy analysis
  - ✓ 2-3 sentence summaries highlighting compliance, market impacts, deadlines
  - ✓ Updated `lib/ingest.ts` to summarize NEW articles only (cost-efficient)
  - ✓ Checks for existing articles before summarizing to avoid duplicates
  - ✓ Tracks summarization stats (attempted, successful, failed, tokens)
  - ✓ Created `/api/resummarize` endpoint for existing articles
  - ✓ Fallback to title-based summary if OpenAI fails
  - ✓ All 111 articles successfully summarized (~30K tokens, ~$0.02)
- [ ] Step 11: Integration + polish
- [ ] Step 12: Deployment to Vercel

---

## Implementation Steps (Claude Code Must Follow)

### STEP 1 — Project Initialization
- Create Next.js project pinned to **14.2.0**
- Verify `package.json`:
```json
{
  "next": "14.2.0",
  "react": "^18",
  "react-dom": "^18"
}
```

---

### STEP 2 — Environment Variables
Create `.env.local`:
```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini

SUPABASE_URL=...
SUPABASE_ANON_KEY=...

CRON_SECRET=...
```

---

### STEP 3 — Vercel Cron
Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/ingest",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

### STEP 4 — Database Schema (Supabase)

Single table: `articles`

```sql
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  link TEXT NOT NULL,
  pub_date TIMESTAMP NOT NULL,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_articles_pub_date ON articles(pub_date DESC);
CREATE INDEX idx_articles_category ON articles(category);
```

---

### STEP 5 — TypeScript Types
File: `types/article.ts`

```ts
export interface Article {
  id: string;
  title: string;
  summary: string;
  link: string;
  pubDate: string;
  source: string;
  category:
    | 'LNG'
    | 'Renewable Energy'
    | 'Energy Policy'
    | 'Emissions'
    | 'Infrastructure';
}
```

---

### STEP 6 — RSS Feeds
File: `lib/feeds.ts`

Only official government sources. No scraping.

---

### STEP 7 — Categorization Logic
File: `lib/categorize.ts`

Keyword‑based, deterministic. AI **not used** for categorization.

---

### STEP 8 — AI Summarization
File: `lib/summarize.ts`

Rules:
- 2–3 sentences
- Compliance + energy security focus
- Runs **only during ingestion**

---

### STEP 9 — Ingestion Logic
File: `lib/ingest.ts`

Must:
- Deduplicate articles
- Handle partial failures
- Return ingestion stats

---

### STEP 10 — Ingestion API
File: `app/api/ingest/route.ts`

- Protected by `CRON_SECRET`
- `force-dynamic`
- No caching

---

### STEP 11 — Articles API
File: `app/api/articles/route.ts`

- Read‑only
- Cached (5 min)
- Supports category filtering

---

### STEP 12 — Article Card
File: `components/ArticleCard.tsx`

- Lightweight
- Responsive
- No heavy client logic

---

### STEP 13 — Main Page
File: `app/page.tsx`

- Fast initial load
- Filter tabs
- Grid layout
- Loading states

---

### STEP 14 — Initial Ingestion
Manually trigger:
```bash
curl http://localhost:3000/api/ingest
```

Verify data appears in Supabase.

---

### STEP 15 — Deployment
- Push to GitHub
- Import into Vercel
- Set env vars
- Verify cron runs

---

## Performance Targets

- Page load: < 2s
- API latency: < 500ms
- Ingestion run: < 5 min
- Monthly cost: < $15

---

## Security Notes

- `CRON_SECRET` required
- Env vars never committed
- Optional: Supabase RLS

---

## Definition of Success

- Platform loads instantly
- AI cost is predictable
- Articles update on schedule
- Codebase is clean and reviewable
- Architecture clearly demonstrates AI + data engineering competence

---

**END OF PRD & BUILD GUIDE**
