/**
 * Proves the "Recent Developments" section survives a flaky articles request.
 *
 * The old client logic gave the articles fetch a single attempt and swallowed
 * any failure into a null result. The grid then cleared its skeletons and fell
 * straight through to the empty state, so one dropped request left the section
 * blank until the five-minute refresh — which is why reloading appeared to fix
 * it while the Archive tab (a separate request) looked fine.
 *
 * This models both strategies against a local server that can fail on demand,
 * so the result is deterministic and needs no dev server.
 *
 * Run: node scripts/verify-finance-resilience.mjs
 */
import { createServer } from 'node:http';

const ARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: `a${i}`,
  source: i < 6 ? 'Yahoo Finance' : 'Gulf Times Qatar',
  title: `Article ${i}`,
}));

const US = new Set(['Yahoo Finance', 'CNBC Energy']);

let flakyHits = 0;
let downHits = 0;

const server = createServer((req, res) => {
  const url = req.url || '';

  // Fails the first two requests, then succeeds: a transient blip.
  if (url.startsWith('/flaky')) {
    flakyHits += 1;
    if (flakyHits <= 2) {
      res.writeHead(503).end('unavailable');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ articles: ARTICLES }));
    return;
  }

  // Never recovers, to check we report an error rather than "no articles".
  if (url.startsWith('/down')) {
    downHits += 1;
    res.writeHead(500).end('boom');
    return;
  }

  // A successful response that genuinely has nothing in it.
  if (url.startsWith('/empty')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ articles: [] }));
    return;
  }

  res.writeHead(404).end();
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

/** The previous behaviour: one attempt, failure indistinguishable from empty. */
async function oldStrategy(path) {
  let articles = [];
  let loading = true;

  const getJson = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };

  const data = await getJson(`${base}${path}`);
  if (data?.articles?.length) articles = data.articles;
  loading = false;

  const visible = articles.filter((a) => US.has(a.source));
  return {
    rendered: visible.length,
    // With only `loading` to go on, an empty list can only mean "no articles".
    state: visible.length > 0 ? 'articles' : loading ? 'skeletons' : 'empty',
  };
}

/** The new behaviour: retries, and tracks status separately from loading. */
async function newStrategy(path) {
  let articles = [];
  let status = 'loading';

  const fetchJson = async (url, { attempts = 3, timeoutMs = 12000 } = {}) => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (response.ok) return await response.json();
      } catch {
        /* retry */
      }
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
    return null;
  };

  const data = await fetchJson(`${base}${path}`);
  if (data?.articles) {
    if (data.articles.length) articles = data.articles;
    status = 'ready';
  } else {
    status = status === 'ready' ? 'ready' : 'error';
  }

  const visible = articles.filter((a) => US.has(a.source));
  return {
    rendered: visible.length,
    state:
      visible.length > 0
        ? 'articles'
        : status === 'loading'
          ? 'skeletons'
          : status === 'error'
            ? 'error+retry'
            : 'empty',
  };
}

let passed = 0;
let failed = 0;
function check(ok, name, detail) {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log(`\n=== Finance page article-loading resilience ===\n`);

console.log(`--- Transient failure (first 2 requests fail, then succeed) ---`);
flakyHits = 0;
const oldFlaky = await oldStrategy('/flaky');
flakyHits = 0;
const t0 = Date.now();
const newFlaky = await newStrategy('/flaky');
const recoveredMs = Date.now() - t0;

console.log(`  OLD  renders ${oldFlaky.rendered} articles, shows "${oldFlaky.state}"`);
console.log(`  NEW  renders ${newFlaky.rendered} articles, shows "${newFlaky.state}" after ${recoveredMs}ms`);
check(oldFlaky.rendered === 0, 'old behaviour loses the articles on a blip', `state=${oldFlaky.state}`);
check(newFlaky.rendered === 6, 'new behaviour recovers and renders them', `state=${newFlaky.state}`);
check(recoveredMs < 5000, 'recovery is fast enough to be invisible', `${recoveredMs}ms`);

console.log(`\n--- Persistent failure ---`);
const oldDown = await oldStrategy('/down');
downHits = 0;
const newDown = await newStrategy('/down');
console.log(`  OLD  shows "${oldDown.state}"`);
console.log(`  NEW  shows "${newDown.state}" after ${downHits} attempts`);
check(oldDown.state === 'empty', 'old behaviour claims there are no articles', oldDown.state);
check(newDown.state === 'error+retry', 'new behaviour reports a failure instead', newDown.state);
check(downHits === 3, 'it retried before giving up', `${downHits} attempts`);

console.log(`\n--- Genuinely empty but successful response ---`);
const newEmpty = await newStrategy('/empty');
check(
  newEmpty.state === 'empty',
  'a real empty result is not reported as an error',
  `state=${newEmpty.state}`
);

server.close();

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
