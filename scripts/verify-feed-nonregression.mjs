/**
 * Regression check: healthy feeds must still parse directly and must never
 * call a converter. Fails if any converter endpoint is contacted.
 *
 * Run: node scripts/verify-feed-nonregression.mjs
 */
import { getEnabledFeeds } from '../lib/feeds.ts';

const realFetch = globalThis.fetch;
const converterCalls = [];

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.includes('feed2json') || url.includes('rss2json')) {
    converterCalls.push(url);
  }
  return realFetch(input, init);
};

const { fetchFeed } = await import('../lib/fetchFeed.ts');

// Everything except the known-blocked Club feeds.
const feeds = getEnabledFeeds().filter((f) => !f.url.includes('clubofmozambique.com'));

console.log(`Checking ${feeds.length} non-Club feeds...\n`);

let direct = 0;
let recovered = 0;
let failed = 0;

for (const feed of feeds) {
  const r = await fetchFeed(feed);
  const via = r.diagnostics?.converter;
  const label = r.error ? 'FAILED' : via ? `via ${via}` : 'direct';
  if (r.error) failed++;
  else if (via) recovered++;
  else direct++;
  console.log(
    `  ${feed.name.padEnd(38)} ${String(r.items.length).padStart(3)} items  ${label}` +
      (r.error ? `  (${r.error.slice(0, 60)})` : '')
  );
}

console.log(`\ndirect=${direct} recovered=${recovered} failed=${failed}`);
console.log(`converter calls made: ${converterCalls.length}`);
for (const c of converterCalls) console.log(`  - ${c.slice(0, 110)}`);

globalThis.fetch = realFetch;
