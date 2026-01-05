-- Migration: Add image_url column to articles table
-- Run this in Supabase SQL Editor
-- Date: 2026-01-04

-- Add the image_url column (nullable)
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.articles.image_url IS 'OpenGraph/Twitter card image URL scraped from article page';

-- Create index for efficient querying of articles needing enrichment
CREATE INDEX IF NOT EXISTS idx_articles_image_url_null 
ON public.articles(pub_date DESC) 
WHERE image_url IS NULL;

