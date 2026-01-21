import { NextRequest, NextResponse } from 'next/server';
import { getEnabledFeeds } from '@/lib/feeds';
import { fetchFeed } from '@/lib/fetchFeed';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Debug endpoint to test feed fetching
 * Returns detailed info about each enabled feed
 */
export async function GET(request: NextRequest) {
  // Validate cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;
  if (cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const feeds = getEnabledFeeds();
  const results = [];

  for (const feed of feeds) {
    const result = await fetchFeed(feed);
    results.push({
      name: feed.name,
      url: feed.url,
      articleType: feed.articleType || 'policy',
      itemCount: result.items.length,
      error: result.error,
      sampleTitles: result.items.slice(0, 3).map(i => i.title),
      diagnostics: result.diagnostics,
    });
  }

  // Separate by type for clarity
  const financeFeeds = results.filter(r => r.articleType === 'finance');
  const policyFeeds = results.filter(r => r.articleType === 'policy');

  return NextResponse.json({
    totalFeeds: feeds.length,
    financeFeeds,
    policyFeeds,
    timestamp: new Date().toISOString(),
  });
}
