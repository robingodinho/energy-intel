-- Migration: Add is_archived column for finance article archiving
-- 
-- This migration adds an is_archived column to the articles table
-- to support archiving old finance articles (keeping only 6 most recent active).
--
-- Run this in Supabase SQL Editor:

-- Add is_archived column (default false)
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create index for faster archived queries
CREATE INDEX IF NOT EXISTS idx_articles_archived ON articles(is_archived);

-- Create composite index for finance article queries
CREATE INDEX IF NOT EXISTS idx_articles_finance_archived 
ON articles(article_type, is_archived, pub_date DESC) 
WHERE article_type = 'finance';
