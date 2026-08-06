/**
 * Verifies the converter fallback in lib/fetchFeed.ts.
 *
 * Simulates Vercel's environment by stubbing fetch() so the publisher's
 * own domain returns 403 (as Cloudflare does from Vercel IPs) while
 * converter traffic is allowed through. Then checks that the recovered
 * items produce the same article IDs as a direct parse would.
 *
 * Run: node scripts/verify-feed-fallback.mjs
 */
import { createHash } from 'node:crypto';
import Parser from 'rss-parser';

const FEEDS = [
  { name: 'Club of Mozambique - Economy', url: 'https://clubofmozambique.com/news/category/economy/feed/' },
  { name: 'Club of Mozambique - Mining & Energy', url: 'https://clubofmozambique.com/news/category/mining-energy/feed/' },
  { name: 'Club of Mozambique - Business', url: 'https://clubofmozambique.com/news/category/business/feed/' },
];

// Mirrors generateArticleId() in lib/normalizeFeedItem.ts
function articleId(item) {
  if (item.guid && item.guid.trim()) {
    return createHash('sha256').update(item.guid.trim()).digest('hex').slice(0, 16);
  }
  if (item.link && item.link.trim()) {
    return createHash('sha256').update(item.link.trim()).digest('hex').slice(0, 16);
  }
  return null;
}

const realFetch = globalThis.fetch;

// Pass --no-feed2json to prove the rss2json second tier also works.
const BLOCK_FEED2JSON = process.argv.includes('--no-feed2json');

async function directParse(url) {
  const res = await realFetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EnergyIntelBot/1.0)' },
  });
  const text = await res.text();
  const parsed = await new Parser().parseString(text);
  return parsed.items.map((i) => ({ title: i.title, link: i.link, guid: i.guid, isoDate: i.isoDate }));
}

// Stub: publisher domain is blocked, everything else (converters) passes.
const blockedFetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (BLOCK_FEED2JSON && url.includes('feed2json')) {
    return new Response('down', { status: 503, statusText: 'Service Unavailable' });
  }
  if (url.includes('clubofmozambique.com') && !url.includes('feed2json') && !url.includes('rss2json')) {
    return new Response('<!DOCTYPE html><html><body>Blocked</body></html>', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'content-type': 'text/html' },
    });
  }
  return realFetch(input, init);
};

async function main() {
  globalThis.fetch = blockedFetch;

  const { fetchFeed } = await import('../lib/fetchFeed.ts');

  let allOk = true;

  for (const feed of FEEDS) {
    const result = await fetchFeed({ ...feed, enabled: true, articleType: 'finance' });

    const converter = result.diagnostics?.converter ?? 'NONE';
    const status = result.error === null ? 'RECOVERED' : 'FAILED';
    console.log(`\n=== ${feed.name} ===`);
    console.log(`  status      : ${status}`);
    console.log(`  via         : ${converter}`);
    console.log(`  directError : ${result.diagnostics?.directError ?? '-'}`);
    console.log(`  items       : ${result.items.length}`);

    if (result.error !== null || result.items.length === 0) {
      allOk = false;
      console.log(`  !! no recovery: ${result.error}`);
      continue;
    }

    // Compare IDs against a direct (unblocked) parse.
    globalThis.fetch = realFetch;
    const direct = await directParse(feed.url);
    globalThis.fetch = blockedFetch;

    const directIds = new Set(direct.map(articleId).filter(Boolean));
    const recoveredIds = result.items.map(articleId);
    const matched = recoveredIds.filter((id) => directIds.has(id)).length;

    console.log(`  direct items: ${direct.length}`);
    console.log(`  ID match    : ${matched}/${recoveredIds.length} identical to direct parse`);

    const missingTitle = result.items.filter((i) => !i.title?.trim()).length;
    const missingLink = result.items.filter((i) => !i.link?.trim()).length;
    const badDate = result.items.filter((i) => !i.isoDate || isNaN(new Date(i.isoDate).getTime())).length;
    console.log(`  missing title/link/date: ${missingTitle}/${missingLink}/${badDate}`);
    console.log(`  newest      : ${result.items[0]?.isoDate}`);
    console.log(`  sample      : ${result.items[0]?.title?.slice(0, 70)}`);

    if (matched !== recoveredIds.length || missingTitle || missingLink || badDate) {
      allOk = false;
    }
  }

  globalThis.fetch = realFetch;
  console.log(`\n${allOk ? 'PASS - all feeds recovered with matching IDs' : 'FAIL - see above'}`);
  process.exit(allOk ? 0 : 1);
}

main();
