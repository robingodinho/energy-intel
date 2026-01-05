/**
 * Feed Testing & Validation Script
 * 
 * Run with: npm run test:feeds
 * 
 * Options (via environment variables):
 *   TEST_ALL=true     - Test all feeds, not just enabled ones
 *   TEST_SOURCE=name  - Test a specific source by name
 *   SEQUENTIAL=true   - Fetch feeds one at a time (slower, but better for debugging)
 * 
 * Examples:
 *   npm run test:feeds                           # Test enabled feeds only
 *   TEST_ALL=true npm run test:feeds             # Test ALL feeds
 *   TEST_SOURCE="Utility Dive" npm run test:feeds # Test specific feed
 */

import { getAllFeeds, getEnabledFeeds, getFeedByName } from '../lib/feeds';
import { 
  fetchAllFeeds, 
  fetchFeedsSequential, 
  fetchFeed,
  getFetchStats, 
  printFetchSummary 
} from '../lib/fetchFeed';
import { normalizeFeedItems } from '../lib/normalizeFeedItem';
import { FeedSource } from '../types/article';

async function testSingleFeed(feed: FeedSource) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${feed.name}`);
  console.log(`URL: ${feed.url}`);
  console.log(`Enabled: ${feed.enabled}`);
  console.log('='.repeat(60));

  const result = await fetchFeed(feed);

  if (result.error) {
    console.log(`\n❌ FAILED: ${result.error}`);
    if (result.diagnostics) {
      console.log('\nDiagnostics:');
      console.log(`  HTTP Status: ${result.diagnostics.httpStatus || 'N/A'}`);
      console.log(`  Content-Type: ${result.diagnostics.contentType || 'N/A'}`);
      if (result.diagnostics.responsePreview) {
        console.log(`\n  Response Preview (first 300 chars):`);
        console.log('  ' + '-'.repeat(50));
        console.log('  ' + result.diagnostics.responsePreview.slice(0, 300).replace(/\n/g, '\n  '));
        console.log('  ' + '-'.repeat(50));
      }
    }
    return false;
  }

  console.log(`\n✅ SUCCESS: ${result.items.length} items fetched`);
  console.log(`  HTTP Status: ${result.diagnostics?.httpStatus || 'N/A'}`);
  console.log(`  Content-Type: ${result.diagnostics?.contentType || 'N/A'}`);

  // Show sample items
  const normalized = normalizeFeedItems(result.items, result.source);
  console.log(`\n  Sample Articles (first 3):`);
  normalized.slice(0, 3).forEach((article, i) => {
    console.log(`\n  ${i + 1}. ${article.title.slice(0, 70)}${article.title.length > 70 ? '...' : ''}`);
    console.log(`     ID: ${article.id}`);
    console.log(`     Date: ${article.pub_date}`);
    console.log(`     Link: ${article.link.slice(0, 60)}...`);
  });

  return true;
}

async function testAllFeeds(feeds: FeedSource[], sequential: boolean = false) {
  console.log('\n' + '='.repeat(60));
  console.log(`TESTING ${feeds.length} FEEDS ${sequential ? '(Sequential Mode)' : '(Parallel Mode)'}`);
  console.log('='.repeat(60));

  feeds.forEach((f, i) => {
    const status = f.enabled ? '✓' : '○';
    console.log(`  ${i + 1}. [${status}] ${f.name}: ${f.url}`);
  });

  console.log('\n⏳ Fetching...\n');

  const results = sequential 
    ? await fetchFeedsSequential(feeds, 1000)
    : await fetchAllFeeds(feeds);

  const stats = getFetchStats(results);
  
  // Print detailed summary table
  printFetchSummary(stats);

  // Print detailed per-source results
  console.log('\nDETAILED RESULTS:');
  console.log('-'.repeat(60));

  for (const result of results) {
    const icon = result.error === null ? '✅' : '❌';
    console.log(`\n${icon} ${result.source}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
      if (result.diagnostics?.httpStatus) {
        console.log(`   HTTP: ${result.diagnostics.httpStatus}`);
      }
      if (result.diagnostics?.contentType) {
        console.log(`   Content-Type: ${result.diagnostics.contentType}`);
      }
    } else {
      console.log(`   Items: ${result.items.length}`);
      
      // Show first item title
      if (result.items.length > 0 && result.items[0].title) {
        console.log(`   Latest: "${result.items[0].title.slice(0, 50)}..."`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Feeds Tested: ${stats.totalFeeds}`);
  console.log(`Successful: ${stats.successfulFeeds} (${Math.round(stats.successfulFeeds / stats.totalFeeds * 100)}%)`);
  console.log(`Failed: ${stats.failedFeeds}`);
  console.log(`Total Items: ${stats.totalItems}`);

  if (stats.failedFeeds > 0) {
    console.log('\n⚠️  FAILED FEEDS:');
    stats.perSource
      .filter((s) => s.status === 'failed')
      .forEach((s) => {
        console.log(`   - ${s.name}: ${s.error}`);
      });
  }

  // Recommendations
  const workingDisabled = stats.perSource.filter(
    (s) => s.status === 'success' && !getEnabledFeeds().find((f) => f.name === s.name)
  );
  
  if (workingDisabled.length > 0) {
    console.log('\n💡 RECOMMENDATION: These disabled feeds are working and could be enabled:');
    workingDisabled.forEach((s) => {
      console.log(`   - ${s.name} (${s.itemCount} items)`);
    });
  }

  return stats;
}

async function main() {
  console.log('🔍 Energy Intel Feed Tester');
  console.log('='.repeat(60));

  const testAll = process.env.TEST_ALL === 'true';
  const testSource = process.env.TEST_SOURCE;
  const sequential = process.env.SEQUENTIAL === 'true';

  // Mode 1: Test a specific source
  if (testSource) {
    const feed = getFeedByName(testSource);
    if (!feed) {
      console.error(`❌ Feed not found: "${testSource}"`);
      console.log('\nAvailable feeds:');
      getAllFeeds().forEach((f) => console.log(`  - ${f.name}`));
      process.exit(1);
    }
    await testSingleFeed(feed);
    return;
  }

  // Mode 2: Test all feeds or just enabled
  const feeds = testAll ? getAllFeeds() : getEnabledFeeds();
  
  if (feeds.length === 0) {
    console.log('No feeds to test. Enable some feeds or use TEST_ALL=true');
    return;
  }

  console.log(`Mode: ${testAll ? 'All Feeds' : 'Enabled Feeds Only'}`);
  console.log(`To test all feeds: TEST_ALL=true npm run test:feeds`);
  console.log(`To test one feed: TEST_SOURCE="Feed Name" npm run test:feeds`);

  await testAllFeeds(feeds, sequential);

  console.log('\n✅ Feed test complete!\n');
}

main().catch(console.error);
