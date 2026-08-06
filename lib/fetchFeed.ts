import Parser from 'rss-parser';
import { RawFeedItem, FeedSource, ArticleType } from '@/types/article';

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

// Configure parser
const parser = new Parser({
  timeout: 15000, // 15 second timeout per feed
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; EnergyIntelBot/1.0; +https://github.com/energy-intel)',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
  },
  customFields: {
    item: ['media:content', 'media:thumbnail', 'media:group', 'image', 'enclosure'],
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
  articleType: ArticleType; // Type of articles from this feed
  // Diagnostic info (populated in dev mode)
  diagnostics?: {
    httpStatus?: number;
    contentType?: string;
    responsePreview?: string;
    parseError?: string;
    // Set when the direct fetch was blocked and a converter served the items.
    converter?: string;
    directError?: string;
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
 * HTTP statuses that mean "the feed exists but the edge refused us".
 * 404/410 are excluded: those feeds are genuinely gone, so retrying
 * through a converter would just waste a request.
 */
const BOT_BLOCK_STATUSES = new Set([401, 403, 406, 409, 429, 500, 502, 503, 520, 521, 522, 526]);

/**
 * Coerce a converter-supplied date into an ISO 8601 string.
 *
 * feed2json returns proper ISO ("2026-08-03T14:35:09.000Z"). rss2json returns
 * a space-separated UTC string ("2026-08-03 14:35:09") which Date() would
 * otherwise read as local time, shifting pub_date by the server's offset.
 */
function toIsoDate(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;

  const value = raw.trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;

  const parsed = new Date(normalized);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Add a throwaway query parameter to the feed URL.
 *
 * The converters cache by exact URL, and feed2json is load-balanced across
 * nodes whose caches fall out of sync — repeated calls with a plain URL were
 * observed returning a mix of current and three-day-old snapshots. A unique
 * parameter forces every node to re-fetch upstream, which is what we need for
 * a news pipeline. WordPress and other feed generators ignore unknown query
 * params, so the upstream response is unchanged.
 */
function withCacheBuster(feedUrl: string): string {
  const separator = feedUrl.includes('?') ? '&' : '?';
  return `${feedUrl}${separator}_cb=${Date.now()}`;
}

/**
 * Fetch a feed through feed2json.org, which returns JSON Feed format.
 */
async function fetchViaFeed2Json(feedUrl: string): Promise<RawFeedItem[] | null> {
  const response = await fetch(
    `https://feed2json.org/convert?url=${encodeURIComponent(withCacheBuster(feedUrl))}`,
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    }
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as { items?: unknown };
  if (!Array.isArray(payload.items) || payload.items.length === 0) return null;

  return payload.items.map((raw) => {
    const item = raw as Record<string, unknown>;
    const isoDate = toIsoDate(item.date_published);

    return {
      title: typeof item.title === 'string' ? item.title : undefined,
      link: typeof item.url === 'string' ? item.url : undefined,
      pubDate: isoDate,
      isoDate,
      content: typeof item.content_html === 'string' ? item.content_html : undefined,
      contentSnippet: typeof item.summary === 'string' ? item.summary : undefined,
      guid: typeof item.guid === 'string' ? item.guid : undefined,
    } satisfies RawFeedItem;
  });
}

/**
 * Fetch a feed through rss2json.com, which returns its own JSON shape.
 */
async function fetchViaRss2Json(feedUrl: string): Promise<RawFeedItem[] | null> {
  const response = await fetch(
    `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(withCacheBuster(feedUrl))}`,
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    }
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as { status?: string; items?: unknown };
  if (payload.status !== 'ok') return null;
  if (!Array.isArray(payload.items) || payload.items.length === 0) return null;

  return payload.items.map((raw) => {
    const item = raw as Record<string, unknown>;
    const isoDate = toIsoDate(item.pubDate);
    const thumbnail = typeof item.thumbnail === 'string' && item.thumbnail.trim()
      ? item.thumbnail.trim()
      : undefined;

    const enclosure = item.enclosure as Record<string, unknown> | undefined;
    const enclosureUrl =
      enclosure && typeof enclosure.link === 'string' && enclosure.link.trim()
        ? enclosure.link.trim()
        : enclosure && typeof enclosure.url === 'string' && enclosure.url.trim()
          ? enclosure.url.trim()
          : undefined;

    return {
      title: typeof item.title === 'string' ? item.title : undefined,
      link: typeof item.link === 'string' ? item.link : undefined,
      pubDate: isoDate,
      isoDate,
      content: typeof item.content === 'string' ? item.content : undefined,
      contentSnippet: typeof item.description === 'string' ? item.description : undefined,
      guid: typeof item.guid === 'string' ? item.guid : undefined,
      image: thumbnail,
      enclosure: enclosureUrl ? { url: enclosureUrl } : undefined,
    } satisfies RawFeedItem;
  });
}

/**
 * Converter fallback for edge-blocked feeds.
 *
 * Cloudflare on some publishers (clubofmozambique.com since 2026-07-31)
 * returns HTTP 403 to Vercel's serverless IP ranges for the /feed/ endpoints,
 * even though the same URL returns 200 from a browser or any residential IP.
 * The block is IP-based, not User-Agent based, so no header tweak recovers it.
 *
 * These converters fetch the feed from their own infrastructure and hand back
 * parsed items. Both preserve the upstream <guid>, so generateArticleId()
 * produces the same IDs as the direct path and de-duplication still holds if
 * the direct fetch starts working again.
 */
async function fetchFeedViaConverter(
  feedUrl: string
): Promise<{ items: RawFeedItem[]; converter: string } | null> {
  const converters: { name: string; fn: (url: string) => Promise<RawFeedItem[] | null> }[] = [
    { name: 'feed2json', fn: fetchViaFeed2Json },
    { name: 'rss2json', fn: fetchViaRss2Json },
  ];

  for (const { name, fn } of converters) {
    try {
      const items = await fn(feedUrl);
      if (items && items.length > 0) {
        // Drop anything the converter couldn't give us a title+link for;
        // normalizeFeedItem would reject those anyway.
        const usable = items.filter((item) => item.title?.trim() && item.link?.trim());
        if (usable.length > 0) {
          return { items: usable, converter: name };
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      devWarn(`Converter ${name} failed for ${feedUrl}: ${msg}`);
    }
  }

  return null;
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

  /**
   * Last-resort recovery for a direct fetch that produced no items.
   * Returns a successful result if a converter can supply the feed,
   * otherwise the original failure so the caller still sees the real cause.
   */
  const recoverOrFail = async (directError: string): Promise<FetchFeedResult> => {
    const recovered = await fetchFeedViaConverter(feed.url);

    if (recovered) {
      devLog(`${feed.name}: ✅ Recovered ${recovered.items.length} items via ${recovered.converter}`);
      return {
        source: feed.name,
        url: feed.url,
        items: recovered.items,
        error: null,
        fetchedAt,
        articleType: feed.articleType || 'policy',
        diagnostics: { ...diagnostics, converter: recovered.converter, directError },
      };
    }

    return {
      source: feed.name,
      url: feed.url,
      items: [],
      error: directError,
      fetchedAt,
      articleType: feed.articleType || 'policy',
      diagnostics: { ...diagnostics, directError },
    };
  };

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

      // An edge block (403 etc.) means the feed is fine but we're refused;
      // a converter can still reach it. A 404 means it's actually gone.
      if (BOT_BLOCK_STATUSES.has(response.status)) {
        return recoverOrFail(errorMsg);
      }

      return {
        source: feed.name,
        url: feed.url,
        items: [],
        error: errorMsg,
        fetchedAt,
        articleType: feed.articleType || 'policy',
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

      // A challenge/interstitial page served with HTTP 200 is still a block.
      return recoverOrFail(errorMsg);
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
        enclosure: item.enclosure,
        image: (item as RawFeedItem).image,
        'media:content': (item as RawFeedItem)['media:content'],
        'media:thumbnail': (item as RawFeedItem)['media:thumbnail'],
      }));

      devLog(`${feed.name}: ✅ Parsed ${items.length} items`);

      return {
        source: feed.name,
        url: feed.url,
        items,
        error: null,
        fetchedAt,
        articleType: feed.articleType || 'policy',
        diagnostics,
      };
    } catch (parseErr) {
      const parseError = parseErr instanceof Error ? parseErr.message : 'Unknown parse error';
      diagnostics.parseError = parseError;
      diagnostics.responsePreview = text.slice(0, 500);
      
      devWarn(`${feed.name}: Parse error - ${parseError}`);
      devWarn(`${feed.name} content preview:`, text.slice(0, 200));

      return recoverOrFail(`Parse error: ${parseError}`);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    devWarn(`${feed.name}: Fetch error - ${errorMessage}`);

    // Covers timeouts and connection resets, which some edges use instead of 403.
    return recoverOrFail(errorMessage);
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
