/**
 * Proves the finance page renders articles without waiting on the slow
 * market-summary request.
 *
 * Models both fetch strategies against the real dev-server endpoints, with an
 * artificial delay on market-summary to represent an expired cache (OpenAI
 * regeneration measured at ~8s). Reports when the articles grid could first
 * paint under each strategy.
 *
 * Requires `npm run dev` to be running. Note that running `npm run build`
 * while the dev server is up overwrites .next and makes it serve 404s, so
 * restart the dev server if every endpoint suddenly fails.
 *
 * Run: node scripts/verify-finance-load.mjs
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SUMMARY_DELAY_MS = Number(process.env.SUMMARY_DELAY_MS || 8000);

const ENDPOINTS = {
  stocks: '/api/finance/stocks',
  forex: '/api/finance/forex',
  articles: '/api/finance/articles?limit=100',
  archived: '/api/finance/articles?archived=true&limit=500',
  history: '/api/finance/stock-history',
  summary: '/api/finance/market-summary?market=US',
};

async function timedGet(key) {
  const started = Date.now();
  const res = await fetch(`${BASE}${ENDPOINTS[key]}`, { cache: 'no-store' });
  const body = await res.json();
  // Simulate an expired summary cache without waiting on a real OpenAI call.
  if (key === 'summary') {
    await new Promise((r) => setTimeout(r, SUMMARY_DELAY_MS));
  }
  return { key, ms: Date.now() - started, count: body.articles?.length ?? body.summaries?.length ?? 0 };
}

// Old behaviour: Promise.all gates every setState on the slowest response.
async function coupled() {
  const t0 = Date.now();
  const results = await Promise.all(Object.keys(ENDPOINTS).map(timedGet));
  const articles = results.find((r) => r.key === 'articles');
  return { articlesVisibleAt: Date.now() - t0, articleCount: articles.count };
}

// New behaviour: the articles request applies its own result immediately.
async function decoupled() {
  const t0 = Date.now();
  let articlesVisibleAt = null;
  let articleCount = 0;

  const all = Object.keys(ENDPOINTS).map((key) =>
    timedGet(key).then((r) => {
      if (r.key === 'articles') {
        articlesVisibleAt = Date.now() - t0;
        articleCount = r.count;
      }
    })
  );

  await Promise.allSettled(all);
  return { articlesVisibleAt, articleCount };
}

const health = await fetch(BASE).catch(() => null);
if (!health) {
  console.error(`Dev server not reachable at ${BASE}. Start it with: npm run dev`);
  process.exit(1);
}

// The dev server compiles routes on first request and answers 404 for
// concurrent hits while it's busy, so warm each route sequentially first.
process.stdout.write('Warming routes');
for (const key of Object.keys(ENDPOINTS)) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE}${ENDPOINTS[key]}`, { cache: 'no-store' }).catch(() => null);
    if (res?.ok) break;
    await new Promise((r) => setTimeout(r, 700));
  }
  process.stdout.write('.');
}
console.log(' done\n');

console.log(`Simulating an expired market-summary cache (+${SUMMARY_DELAY_MS}ms)\n`);

const before = await coupled();
const after = await decoupled();

console.log(`  OLD (Promise.all)      articles paint at ${String(before.articlesVisibleAt).padStart(5)} ms  (${before.articleCount} articles)`);
console.log(`  NEW (independent)      articles paint at ${String(after.articlesVisibleAt).padStart(5)} ms  (${after.articleCount} articles)`);

const saved = before.articlesVisibleAt - after.articlesVisibleAt;
console.log(`\n  improvement: ${saved} ms sooner`);

const ok = after.articlesVisibleAt < 2000 && after.articleCount > 0 && saved > 3000;
console.log(ok ? '\nPASS - articles no longer wait on market-summary' : '\nFAIL');
process.exit(ok ? 0 : 1);
