-- Migration: Add market_summaries table for caching AI-generated market summaries
-- 
-- This table caches the AI-generated market summaries to avoid
-- calling OpenAI on every page load. Summaries are regenerated
-- every 6 hours with the CRON job.
--
-- Run this in Supabase SQL Editor:

-- Create market_summaries table
CREATE TABLE IF NOT EXISTS market_summaries (
  id TEXT PRIMARY KEY,
  summaries JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE market_summaries IS 'Cache for AI-generated market summary headlines';

