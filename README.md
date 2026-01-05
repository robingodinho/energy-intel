# U.S. Energy Intelligence Platform (Next.js 14)

## Overview
The **U.S. Energy Intelligence Platform** is a high-performance, AI-powered web application that aggregates, summarizes, and categorizes near real-time U.S. energy and environmental policy updates.

This project prioritizes:
- **Fast load times**
- **Cost-efficient AI usage**
- **Reliable, scheduled data ingestion**
- **Clear separation between ingestion and serving**

> **Version constraint (important):** This repo is designed to use **Next.js 14.x** (do not upgrade to Next.js 15+).

---

## Core Goals

1. **Speed**
   - Pages should load quickly for users
   - No AI calls during page render
   - Heavy processing runs ahead of time

2. **Reliability**
   - Ingestion runs on a schedule, independent of users
   - Feed remains stable if upstream sources are temporarily unavailable

3. **Cost Control**
   - AI summarization runs once per article
   - Cached results are reused across all users

4. **Clarity**
   - Clean architecture
   - Minimal but extensible feature set
   - Easy for reviewers and contributors to understand

---

## High-Level Architecture

```
RSS Sources (FERC, EPA, DOE, EIA)
        ↓
Scheduled Ingestion (Cron)
        ↓
AI Summarization & Categorization
        ↓
Database Storage
        ↓
Fast Read-Only API
        ↓
Frontend Feed (Instant Load)
```

---

## Technology Stack

### Frontend
- **Next.js 14.x** (App Router)
- TypeScript
- Tailwind CSS

### Backend
- Next.js API Routes (Serverless)
- Scheduled ingestion via **Vercel Cron**

### Data & Storage
- Supabase Postgres (single-table design)
- Indexed for fast reads and sorting

### AI
- OpenAI API
- Model configurable via environment variable
- Summaries focus on:
  - Regulatory impact
  - Compliance implications
  - Energy security and sustainability relevance

### Deployment
- Vercel (free tier compatible)

---

## Data Sources
The platform ingests data from **official U.S. government RSS feeds**, including:
- Federal Energy Regulatory Commission (FERC)
- Environmental Protection Agency (EPA)
- Department of Energy (DOE)
- Energy Information Administration (EIA)

Only metadata and short excerpts are stored. All articles link back to original sources.

---

## Project Structure

```
energy-intel/
├── app/
│   ├── api/
│   │   ├── ingest/          # Scheduled ingestion (cron)
│   │   │   └── route.ts
│   │   └── articles/        # Fast read-only API
│   │       └── route.ts
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   └── ArticleCard.tsx
│
├── lib/
│   ├── feeds.ts             # RSS feed definitions
│   ├── ingest.ts            # Shared ingestion logic
│   ├── summarize.ts         # AI summarization
│   ├── categorize.ts        # Category inference
│   └── db.ts                # Supabase client
│
├── types/
│   └── article.ts
│
├── .env.local
├── vercel.json              # Cron configuration
├── package.json
└── README.md
```

---

## Key Design Decisions

### 1) No AI Calls on Page Load
AI summarization **never runs during a user request**. This:
- Keeps pages fast
- Avoids serverless timeouts
- Makes costs predictable

### 2) Scheduled Ingestion
A cron-triggered endpoint fetches and processes articles on a schedule. Users always read from pre-processed data.

### 3) Minimal Database Design
A single `articles` table is enough for v1:
- stable history
- deduping
- fast sorting/filtering

### 4) Separation of Concerns
- Ingestion ≠ serving
- AI logic ≠ UI logic
- Storage ≠ presentation

---

## Version Pinning (Next.js 14.x)

To ensure Next.js stays on version 14, pin it in `package.json`:

```json
{
  "dependencies": {
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18"
  }
}
```

Also ensure your Node version is compatible with Next.js 14 (Node 18+ recommended).

---

## Environment Variables

Create `.env.local`:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Local Development

```bash
npm install
npm run dev
```

Open:
- http://localhost:3000

---

## Deployment (Vercel)

1. Push repo to GitHub
2. Import into Vercel
3. Set environment variables in Vercel Project Settings
4. Configure cron using `vercel.json` (example below)

### Example `vercel.json` (cron)
```json
{
  "crons": [
    {
      "path": "/api/ingest",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

---

## Performance Characteristics
- **Initial page load:** fast (DB read only)
- **API latency:** low (indexed queries)
- **AI cost:** mostly flat (not traffic-dependent)
- **Scales cleanly** with additional users

---

## Future Enhancements (Optional)
- Full-text search
- Topic alerts / notifications
- Trend analytics and visualizations
- Multi-language summaries
- User-configurable feeds

These are intentionally excluded from v1 to preserve speed and simplicity.

---

## Purpose
This platform demonstrates practical AI + data engineering for:
- Regulatory intelligence
- Energy policy monitoring
- Compliance-oriented information systems

Designed as a real, verifiable system suitable for professional, academic, or policy-focused evaluation.
