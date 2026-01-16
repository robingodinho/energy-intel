import { getEnabledFeeds, getEnabledFeedsByType } from './feeds';
import { fetchAllFeeds, getFetchStats, FetchFeedResult } from './fetchFeed';
import { normalizeFeedItems, PartialArticle } from './normalizeFeedItem';
import { insertArticles, getExistingArticleIds, getExistingArticleTitles, ArticleInsert } from './db';
import { ArticleCategory, FeedSource } from '@/types/article';
import { summarizeArticle, isOpenAIConfigured, getFallbackSummary } from './summarize';

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Per-source ingestion result
 */
export interface SourceIngestionResult {
  source: string;
  fetchStatus: 'success' | 'failed';
  fetchError?: string;
  itemsFetched: number;
  itemsNormalized: number;
  itemsInserted: number;
  itemsSkipped: number;
  skipReasons: string[];
}

/**
 * Overall ingestion run statistics
 */
export interface IngestionStats {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  
  // Feed stats
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  
  // Article stats
  totalItemsFetched: number;
  totalItemsNormalized: number;
  totalItemsAttempted: number;
  totalItemsInserted: number;       // New rows inserted
  totalItemsDuplicates: number;     // Existing rows skipped (not an error)
  totalItemsSkipped: number;        // Skipped due to validation
  totalDbErrors: number;            // Actual database errors
  
  // AI summarization stats
  summarization: {
    enabled: boolean;
    attempted: number;
    successful: number;
    failed: number;
    tokensUsed: number;
  };
  
  // Per-source breakdown
  perSource: SourceIngestionResult[];
  
  // Errors
  errors: string[];
}

/**
 * Validate a partial article has all required fields
 */
function validateArticle(article: PartialArticle): { valid: boolean; reason?: string } {
  if (!article.id || article.id.trim() === '') {
    return { valid: false, reason: 'Missing id' };
  }
  if (!article.title || article.title.trim() === '') {
    return { valid: false, reason: 'Missing title' };
  }
  if (!article.link || article.link.trim() === '') {
    return { valid: false, reason: 'Missing link' };
  }
  if (!article.pub_date || article.pub_date.trim() === '') {
    return { valid: false, reason: 'Missing pub_date' };
  }
  if (!article.source || article.source.trim() === '') {
    return { valid: false, reason: 'Missing source' };
  }
  if (!article.category || article.category.trim() === '') {
    return { valid: false, reason: 'Missing category' };
  }
  return { valid: true };
}

/**
 * Convert PartialArticle to ArticleInsert with a summary
 * 
 * @param article - Partial article data
 * @param summary - AI-generated or fallback summary
 */
function toArticleInsert(article: PartialArticle, summary: string): ArticleInsert {
  return {
    id: article.id,
    title: article.title,
    link: article.link,
    pub_date: article.pub_date,
    source: article.source,
    category: article.category as ArticleCategory,
    summary,
    // Preserve the source article type so finance feeds are queryable
    article_type: article.article_type || 'policy',
  };
}

/**
 * Process a single feed result into validated partial articles
 */
function processFeedResult(result: FetchFeedResult): {
  articles: PartialArticle[];
  skipped: number;
  skipReasons: string[];
} {
  const skipReasons: string[] = [];
  let skipped = 0;

  if (result.error) {
    return { articles: [], skipped: 0, skipReasons: [] };
  }

  // Normalize raw items (passing articleType from feed source)
  const normalized = normalizeFeedItems(result.items, result.source, result.articleType);
  
  // Validate articles
  const articles: PartialArticle[] = [];
  
  for (const article of normalized) {
    const validation = validateArticle(article);
    if (!validation.valid) {
      skipped++;
      skipReasons.push(`${article.title?.slice(0, 30) || 'Unknown'}: ${validation.reason}`);
      continue;
    }
    articles.push(article);
  }

  return { articles, skipped, skipReasons };
}

/**
 * Dev-only logging helper
 */
function devLog(message: string, data?: unknown) {
  if (isDev) {
    console.log(`[ingest] ${message}`, data ?? '');
  }
}

/**
 * Run the full ingestion pipeline
 * 
 * 1. Fetch all enabled RSS feeds
 * 2. Normalize feed items to articles
 * 3. Validate required fields
 * 4. Check for existing articles (to avoid re-summarizing)
 * 5. Generate AI summaries for NEW articles only
 * 6. Insert into Supabase (with duplicate handling)
 * 7. Return detailed statistics
 */
export async function runIngestion(feedsOverride?: FeedSource[]): Promise<IngestionStats> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  
  devLog('Starting ingestion run...');

  // Get enabled feeds
  const feeds = feedsOverride ?? getEnabledFeeds();
  devLog(`Found ${feeds.length} enabled feeds`);

  // Fetch all feeds in parallel
  const fetchResults = await fetchAllFeeds(feeds);
  const fetchStats = getFetchStats(fetchResults);
  
  devLog(`Fetch complete: ${fetchStats.successfulFeeds}/${fetchStats.totalFeeds} feeds, ${fetchStats.totalItems} items`);

  // Process each feed result
  const perSource: SourceIngestionResult[] = [];
  const allPartialArticles: PartialArticle[] = [];
  const allErrors: string[] = [...fetchStats.errors];

  for (const result of fetchResults) {
    const sourceResult: SourceIngestionResult = {
      source: result.source,
      fetchStatus: result.error ? 'failed' : 'success',
      fetchError: result.error || undefined,
      itemsFetched: result.items.length,
      itemsNormalized: 0,
      itemsInserted: 0,
      itemsSkipped: 0,
      skipReasons: [],
    };

    if (result.error) {
      perSource.push(sourceResult);
      continue;
    }

    // Process feed items
    const { articles, skipped, skipReasons } = processFeedResult(result);
    
    sourceResult.itemsNormalized = articles.length + skipped;
    sourceResult.itemsSkipped = skipped;
    sourceResult.skipReasons = skipReasons;
    
    // Collect articles
    allPartialArticles.push(...articles);
    
    perSource.push(sourceResult);
  }

  devLog(`Processed ${allPartialArticles.length} articles`);

  // Summarization stats
  const summarizationStats = {
    enabled: isOpenAIConfigured(),
    attempted: 0,
    successful: 0,
    failed: 0,
    tokensUsed: 0,
  };

  // ==========================================
  // DEDUPLICATION: ID-based + Title-based
  // ==========================================
  
  // Step 1: Deduplicate within current batch by title (keep first occurrence)
  const seenTitles = new Set<string>();
  const batchDeduped = allPartialArticles.filter(article => {
    const normalizedTitle = article.title.toLowerCase().trim();
    if (seenTitles.has(normalizedTitle)) {
      devLog(`Skipping duplicate title in batch: "${article.title.slice(0, 40)}..."`);
      return false;
    }
    seenTitles.add(normalizedTitle);
    return true;
  });
  
  if (batchDeduped.length < allPartialArticles.length) {
    devLog(`Removed ${allPartialArticles.length - batchDeduped.length} duplicates within batch`);
  }

  // Step 2: Check which article IDs already exist in database
  const allIds = batchDeduped.map(a => a.id);
  const existingIds = await getExistingArticleIds(allIds);
  const afterIdDedup = batchDeduped.filter(a => !existingIds.has(a.id));
  
  devLog(`Found ${existingIds.size} existing IDs, ${afterIdDedup.length} remain after ID dedup`);

  // Step 3: Check for duplicate titles in database (catches same article with different ID)
  const remainingTitles = afterIdDedup.map(a => a.title);
  const existingTitles = await getExistingArticleTitles(remainingTitles);
  const newArticles = afterIdDedup.filter(article => {
    const normalizedTitle = article.title.toLowerCase().trim();
    if (existingTitles.has(normalizedTitle)) {
      devLog(`Skipping article with existing title: "${article.title.slice(0, 40)}..."`);
      return false;
    }
    return true;
  });
  
  if (newArticles.length < afterIdDedup.length) {
    devLog(`Removed ${afterIdDedup.length - newArticles.length} articles with duplicate titles in database`);
  }
  
  devLog(`Final count: ${newArticles.length} new unique articles to process`);

  // Generate summaries for new articles
  const summaryMap = new Map<string, string>();
  
  if (newArticles.length > 0 && summarizationStats.enabled) {
    devLog(`Generating AI summaries for ${newArticles.length} new articles...`);
    
    for (const article of newArticles) {
      summarizationStats.attempted++;
      
      const result = await summarizeArticle(article.title, undefined, article.source);
      
      if (result.success && result.summary) {
        summaryMap.set(article.id, result.summary);
        summarizationStats.successful++;
        summarizationStats.tokensUsed += result.tokensUsed || 0;
      } else {
        // Use fallback summary on failure
        summaryMap.set(article.id, getFallbackSummary(article.title));
        summarizationStats.failed++;
        if (result.error) {
          allErrors.push(`Summarization failed for "${article.title.slice(0, 30)}...": ${result.error}`);
        }
      }
      
      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    devLog(`Summarization complete: ${summarizationStats.successful}/${summarizationStats.attempted} successful`);
  } else if (newArticles.length > 0) {
    devLog('OpenAI not configured, using fallback summaries');
    for (const article of newArticles) {
      summaryMap.set(article.id, getFallbackSummary(article.title));
    }
  }

  // Convert to ArticleInsert with summaries
  const allArticles: ArticleInsert[] = allPartialArticles.map(article => {
    // Use AI summary if available, otherwise fallback
    const summary = summaryMap.get(article.id) || getFallbackSummary(article.title);
    return toArticleInsert(article, summary);
  });

  // Insert all articles into Supabase
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalDbErrors = 0;

  if (allArticles.length > 0) {
    const { inserted, errors } = await insertArticles(allArticles);
    totalInserted = inserted;
    
    // If no errors but fewer inserted than attempted, rest are duplicates
    if (errors.length === 0) {
      totalDuplicates = allArticles.length - inserted;
    } else {
      // Actual database errors occurred
      totalDbErrors = allArticles.length - inserted;
      allErrors.push(...errors);
    }

    const duplicateMsg = totalDuplicates > 0 ? `, ${totalDuplicates} duplicates skipped` : '';
    devLog(`Inserted ${inserted} new articles${duplicateMsg}`);

    // Update per-source insert counts
    for (const sourceResult of perSource) {
      if (sourceResult.fetchStatus === 'success') {
        const sourceArticles = allArticles.filter(a => a.source === sourceResult.source);
        sourceResult.itemsInserted = sourceArticles.length;
      }
    }
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  // Calculate totals
  const totalItemsFetched = perSource.reduce((sum, s) => sum + s.itemsFetched, 0);
  const totalItemsNormalized = perSource.reduce((sum, s) => sum + s.itemsNormalized, 0);
  const totalItemsSkipped = perSource.reduce((sum, s) => sum + s.itemsSkipped, 0);

  const stats: IngestionStats = {
    startedAt,
    completedAt,
    durationMs,
    
    totalSources: feeds.length,
    successfulSources: fetchStats.successfulFeeds,
    failedSources: fetchStats.failedFeeds,
    
    totalItemsFetched,
    totalItemsNormalized,
    totalItemsAttempted: allArticles.length,
    totalItemsInserted: totalInserted,
    totalItemsDuplicates: totalDuplicates,
    totalItemsSkipped,
    totalDbErrors,
    
    summarization: summarizationStats,
    
    perSource,
    errors: allErrors,
  };

  // Print summary in dev mode
  if (isDev) {
    printIngestionSummary(stats);
  }

  return stats;
}

/**
 * Print a formatted ingestion summary (dev only)
 */
export function printIngestionSummary(stats: IngestionStats): void {
  console.log('\n' + '='.repeat(80));
  console.log('INGESTION RUN SUMMARY');
  console.log('='.repeat(80));
  console.log(`Started: ${stats.startedAt}`);
  console.log(`Duration: ${stats.durationMs}ms`);
  console.log('-'.repeat(80));
  console.log(`Sources: ${stats.successfulSources}/${stats.totalSources} successful`);
  console.log(`Items Fetched: ${stats.totalItemsFetched}`);
  console.log(`Items Normalized: ${stats.totalItemsNormalized}`);
  console.log(`Items Attempted: ${stats.totalItemsAttempted}`);
  console.log(`Items Inserted: ${stats.totalItemsInserted} (new)`);
  console.log(`Items Duplicates: ${stats.totalItemsDuplicates} (already existed)`);
  console.log(`Items Skipped: ${stats.totalItemsSkipped} (validation)`);
  console.log(`DB Errors: ${stats.totalDbErrors}`);
  console.log('-'.repeat(80));
  console.log('AI SUMMARIZATION:');
  console.log('-'.repeat(80));
  console.log(`Enabled: ${stats.summarization.enabled ? 'Yes' : 'No'}`);
  console.log(`Attempted: ${stats.summarization.attempted}`);
  console.log(`Successful: ${stats.summarization.successful}`);
  console.log(`Failed: ${stats.summarization.failed}`);
  console.log(`Tokens Used: ${stats.summarization.tokensUsed}`);
  console.log('-'.repeat(80));
  console.log('PER-SOURCE BREAKDOWN:');
  console.log('-'.repeat(80));
  console.log('Source'.padEnd(25) + 'Status'.padEnd(10) + 'Fetched'.padEnd(10) + 'Inserted'.padEnd(10) + 'Skipped');
  console.log('-'.repeat(80));
  
  for (const source of stats.perSource) {
    const status = source.fetchStatus === 'success' ? '✅' : '❌';
    console.log(
      source.source.padEnd(25) +
      status.padEnd(10) +
      source.itemsFetched.toString().padEnd(10) +
      source.itemsInserted.toString().padEnd(10) +
      source.itemsSkipped.toString()
    );
  }
  
  if (stats.errors.length > 0) {
    console.log('-'.repeat(80));
    console.log('ERRORS:');
    stats.errors.forEach(e => console.log(`  - ${e}`));
  }
  
  console.log('='.repeat(80) + '\n');
}

