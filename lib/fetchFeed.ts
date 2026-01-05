import Parser from 'rss-parser';
import { RawFeedItem, FeedSource } from '@/types/article';

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

// Configure parser
const parser = new Parser({
  timeout: 15000, // 15 second timeout per feed
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; EnergyIntelBot/1.0; +https://github.com/energy-intel)',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
  },
});

/**
 * Result of fetching a single feed
 */
export interface FetchFeedResult {
  source: string;
  url: string;
  items: RawFeedItem[];
  error: string | null;
  fetchedAt: string;
  // Diagnostic info (populated in dev mode)
  diagnostics?: {
    httpStatus?: number;
    contentType?: string;
    responsePreview?: string;
    parseError?: string;
  };
}

/**
 * Dev-only logging helper
 */
function devLog(message: string, data?: unknown) {
  if (isDev) {
    console.log(`[fetchFeed] ${message}`, data ?? '');
  }
}

/**
 * Dev-only warning helper
 */
function devWarn(message: string, data?: unknown) {
  if (isDev) {
    console.warn(`[fetchFeed] ⚠️  ${message}`, data ?? '');
  }
}

/**
 * Fetch and parse a single RSS feed
 * 
 * Uses fetch() + parseString() for better error diagnostics
 * instead of parseURL() which hides HTTP-level errors.
 * 
 * @param feed - Feed source configuration
 * @returns Parsed feed items or error with diagnostics
 */
export async function fetchFeed(feed: FeedSource): Promise<FetchFeedResult> {
  const fetchedAt = new Date().toISOString();
  const diagnostics: FetchFeedResult['diagnostics'] = {};

  devLog(`Fetching: ${feed.name}`, feed.url);

  try {
    // Step 1: Fetch the raw response
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EnergyIntelBot/1.0; +https://github.com/energy-intel)',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    diagnostics.httpStatus = response.status;
    diagnostics.contentType = response.headers.get('content-type') || undefined;

    devLog(`${feed.name}: HTTP ${response.status}, Content-Type: ${diagnostics.contentType}`);

    // Check for non-OK status
    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      devWarn(`${feed.name}: ${errorMsg}`);
      
      // Try to get response preview for debugging
      try {
        const text = await response.text();
        diagnostics.responsePreview = text.slice(0, 500);
        devWarn(`${feed.name} response preview:`, diagnostics.responsePreview.slice(0, 200));
      } catch {
        // Ignore preview errors
      }

      return {
        source: feed.name,
        url: feed.url,
        items: [],
        error: errorMsg,
        fetchedAt,
        diagnostics,
      };
    }

    // Step 2: Get response text
    const text = await response.text();
    
    // Check if response looks like HTML (bot protection, redirect page)
    const trimmedText = text.trim().toLowerCase();
    if (trimmedText.startsWith('<!doctype') || trimmedText.startsWith('<html')) {
      const errorMsg = 'Response is HTML, not XML/RSS (possible bot protection or redirect)';
      diagnostics.responsePreview = text.slice(0, 500);
      devWarn(`${feed.name}: ${errorMsg}`);
      devWarn(`${feed.name} HTML preview:`, text.slice(0, 200));
      
      return {
        source: feed.name,
        url: feed.url,
        items: [],
        error: errorMsg,
        fetchedAt,
        diagnostics,
      };
    }

    // Step 3: Parse the XML/RSS
    try {
      const parsed = await parser.parseString(text);
      
      // Map parser output to our RawFeedItem type
      const items: RawFeedItem[] = (parsed.items || []).map((item) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        isoDate: item.isoDate,
        content: item.content,
        contentSnippet: item.contentSnippet,
        guid: item.guid,
      }));

      devLog(`${feed.name}: ✅ Parsed ${items.length} items`);

      return {
        source: feed.name,
        url: feed.url,
        items,
        error: null,
        fetchedAt,
        diagnostics,
      };
    } catch (parseErr) {
      const parseError = parseErr instanceof Error ? parseErr.message : 'Unknown parse error';
      diagnostics.parseError = parseError;
      diagnostics.responsePreview = text.slice(0, 500);
      
      devWarn(`${feed.name}: Parse error - ${parseError}`);
      devWarn(`${feed.name} content preview:`, text.slice(0, 200));

      return {
        source: feed.name,
        url: feed.url,
        items: [],
        error: `Parse error: ${parseError}`,
        fetchedAt,
        diagnostics,
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    devWarn(`${feed.name}: Fetch error - ${errorMessage}`);
    
    return {
      source: feed.name,
      url: feed.url,
      items: [],
      error: errorMessage,
      fetchedAt,
      diagnostics,
    };
  }
}

/**
 * Fetch all feeds in parallel with error isolation
 * 
 * Each feed is fetched independently - one failure doesn't affect others
 * 
 * @param feeds - Array of feed sources to fetch
 * @returns Array of fetch results (success or error per feed)
 */
export async function fetchAllFeeds(feeds: FeedSource[]): Promise<FetchFeedResult[]> {
  const results = await Promise.all(
    feeds.map((feed) => fetchFeed(feed))
  );
  
  return results;
}

/**
 * Fetch feeds sequentially (useful for debugging)
 * 
 * @param feeds - Array of feed sources to fetch
 * @param delayMs - Delay between requests (default 500ms)
 * @returns Array of fetch results
 */
export async function fetchFeedsSequential(
  feeds: FeedSource[],
  delayMs: number = 500
): Promise<FetchFeedResult[]> {
  const results: FetchFeedResult[] = [];
  
  for (const feed of feeds) {
    const result = await fetchFeed(feed);
    results.push(result);
    
    // Small delay between requests to be polite
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

/**
 * Summary stats from a batch fetch
 */
export interface FetchStats {
  totalFeeds: number;
  successfulFeeds: number;
  failedFeeds: number;
  totalItems: number;
  errors: string[];
  perSource: {
    name: string;
    status: 'success' | 'failed';
    itemCount: number;
    error?: string;
    httpStatus?: number;
    contentType?: string;
  }[];
}

/**
 * Get detailed summary statistics from fetch results
 */
export function getFetchStats(results: FetchFeedResult[]): FetchStats {
  const perSource = results.map((r) => ({
    name: r.source,
    status: (r.error === null ? 'success' : 'failed') as 'success' | 'failed',
    itemCount: r.items.length,
    error: r.error || undefined,
    httpStatus: r.diagnostics?.httpStatus,
    contentType: r.diagnostics?.contentType,
  }));

  const successfulFeeds = results.filter((r) => r.error === null).length;
  const failedFeeds = results.filter((r) => r.error !== null).length;
  const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
  const errors = results
    .filter((r) => r.error !== null)
    .map((r) => `${r.source}: ${r.error}`);

  return {
    totalFeeds: results.length,
    successfulFeeds,
    failedFeeds,
    totalItems,
    errors,
    perSource,
  };
}

/**
 * Print a formatted summary table (dev only)
 */
export function printFetchSummary(stats: FetchStats): void {
  if (!isDev) return;

  console.log('\n' + '='.repeat(80));
  console.log('FEED FETCH SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total: ${stats.totalFeeds} | Success: ${stats.successfulFeeds} | Failed: ${stats.failedFeeds} | Items: ${stats.totalItems}`);
  console.log('-'.repeat(80));
  console.log('Source'.padEnd(25) + 'Status'.padEnd(10) + 'Items'.padEnd(8) + 'HTTP'.padEnd(6) + 'Error');
  console.log('-'.repeat(80));
  
  for (const source of stats.perSource) {
    const status = source.status === 'success' ? '✅' : '❌';
    const http = source.httpStatus?.toString() || '-';
    const error = source.error ? source.error.slice(0, 35) + '...' : '-';
    console.log(
      source.name.padEnd(25) +
      status.padEnd(10) +
      source.itemCount.toString().padEnd(8) +
      http.padEnd(6) +
      error
    );
  }
  console.log('='.repeat(80) + '\n');
}
