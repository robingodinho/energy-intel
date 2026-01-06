-- Migration: Add job_runs table for cron heartbeat tracking
-- Run this in Supabase SQL Editor
-- Date: 2026-01-07
--
-- PURPOSE:
-- This table stores the most recent run of each cron job, allowing you to verify
-- that external cron services (like cron-job.org) are successfully calling your
-- endpoints WITHOUT needing Vercel paid logs.
--
-- USAGE:
-- Query this table from Supabase dashboard or via API to check when jobs last ran:
--   SELECT * FROM job_runs ORDER BY ran_at DESC;

-- Create the job_runs table
CREATE TABLE IF NOT EXISTS public.job_runs (
  -- Primary key: job name (e.g., 'orchestrator', 'ingest', 'enrich-images')
  job_name TEXT PRIMARY KEY,
  
  -- When the job ran (ISO timestamp)
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Job status: 'success' or 'error'
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  
  -- How long the job took in milliseconds
  duration_ms INTEGER NOT NULL DEFAULT 0,
  
  -- Number of new articles inserted during this run
  articles_inserted INTEGER NOT NULL DEFAULT 0,
  
  -- Number of articles that were duplicates/already existed
  articles_updated INTEGER NOT NULL DEFAULT 0,
  
  -- Number of images successfully enriched
  images_enriched INTEGER NOT NULL DEFAULT 0,
  
  -- Error message if status='error', null otherwise
  error_message TEXT NULL,
  
  -- The host header from the request (helps identify caller)
  host TEXT NULL,
  
  -- Timestamp when this row was created/updated
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.job_runs IS 'Tracks the most recent run of each cron job for heartbeat monitoring';
COMMENT ON COLUMN public.job_runs.job_name IS 'Unique identifier for the job (e.g., orchestrator)';
COMMENT ON COLUMN public.job_runs.ran_at IS 'When the job started running';
COMMENT ON COLUMN public.job_runs.status IS 'success or error';
COMMENT ON COLUMN public.job_runs.duration_ms IS 'Total job duration in milliseconds';
COMMENT ON COLUMN public.job_runs.articles_inserted IS 'Count of new articles inserted';
COMMENT ON COLUMN public.job_runs.articles_updated IS 'Count of duplicate articles skipped';
COMMENT ON COLUMN public.job_runs.images_enriched IS 'Count of images successfully added';
COMMENT ON COLUMN public.job_runs.error_message IS 'Error details if job failed';
COMMENT ON COLUMN public.job_runs.host IS 'Request host header for debugging';

-- Create index for quick lookups by ran_at
CREATE INDEX IF NOT EXISTS idx_job_runs_ran_at ON public.job_runs(ran_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow the service role to read/write
-- (Adjust based on your security requirements)
CREATE POLICY "Allow all access for authenticated users" ON public.job_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE ON public.job_runs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.job_runs TO authenticated;

