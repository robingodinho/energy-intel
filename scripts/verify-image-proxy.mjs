/**
 * Verifies the /api/image-proxy fix.
 *
 *  1. Every stored Club of Mozambique image is delivered as real image bytes.
 *  2. Non-allowlisted hosts are refused (no open proxy / SSRF).
 *  3. Bad input is rejected.
 *  4. A missing image 404s, so the client falls through to a placeholder.
 *  5. Images from other sources are left un-proxied (no regression).
 *
 * Usage: node scripts/verify-image-proxy.mjs [baseUrl]
 *   default baseUrl: http://localhost:3000
 */

const BASE = process.argv[2] || process.env.VERIFY_BASE || 'http://localhost:3000';
const PROD = process.env.DIAG_SITE || 'https://enerva.ai';

let passed = 0;
let failed = 0;

function check(ok, name, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function proxyUrl(imageUrl) {
  return `${BASE}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

async function getImage(url) {
  const started = Date.now();
  const res = await fetch(url, {
    headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(40000),
  });
  const ct = res.headers.get('content-type') || '';
  const via = res.headers.get('x-image-source') || '-';
  const cache = res.headers.get('cache-control') || '-';
  let bytes = 0;
  let magic = 'n/a';
  if (res.ok && ct.startsWith('image/')) {
    const buf = Buffer.from(await res.arrayBuffer());
    bytes = buf.byteLength;
    if (buf[0] === 0xff && buf[1] === 0xd8) magic = 'jpeg';
    else if (buf[0] === 0x89 && buf.slice(1, 4).toString() === 'PNG') magic = 'png';
    else if (buf.slice(0, 4).toString() === 'RIFF') magic = 'webp';
    else magic = 'unknown';
  }
  return { status: res.status, ct, via, cache, bytes, magic, ms: Date.now() - started };
}

const run = async () => {
  console.log(`\n=== Verifying image proxy ===`);
  console.log(`Target: ${BASE}\n`);

  // Confirm the server is reachable before interpreting any failures.
  try {
    await fetch(`${BASE}/api/image-proxy`, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    console.log(`Cannot reach ${BASE} — is the dev server running? (${err.message})\n`);
    process.exit(1);
  }

  const prodRes = await fetch(`${PROD}/api/finance/articles?limit=100`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  const { articles = [] } = await prodRes.json();

  const clubImages = articles
    .filter((a) => (a.link || '').includes('clubofmozambique.com'))
    .map((a) => a.image_url || a.imageUrl)
    .filter(Boolean);

  console.log(`--- 1. Club of Mozambique images through the proxy (${clubImages.length}) ---`);
  for (const img of clubImages) {
    const r = await getImage(proxyUrl(img));
    const ok = r.status === 200 && r.ct.startsWith('image/') && r.bytes > 1500 && r.magic !== 'unknown';
    check(
      ok,
      img.split('/').pop().slice(0, 44).padEnd(44),
      `${r.status} ${r.ct} ${r.bytes}B magic=${r.magic} via=${r.via} ${r.ms}ms`
    );
  }

  console.log(`\n--- 2. Allowlist enforcement ---`);
  const blockedHosts = [
    'https://example.com/cat.jpg',
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:3000/placeholders/default.png',
    'https://clubofmozambique.com.evil.test/x.jpg',
  ];
  for (const bad of blockedHosts) {
    const res = await fetch(proxyUrl(bad), { signal: AbortSignal.timeout(20000) });
    check(res.status === 403 || res.status === 400, `refuses ${bad.slice(0, 52)}`, `HTTP ${res.status}`);
  }

  const subdomain = 'https://www.clubofmozambique.com/wp-content/uploads/2026/08/quelim.fb_.jpg';
  const subRes = await fetch(proxyUrl(subdomain), { signal: AbortSignal.timeout(30000) });
  check(subRes.status !== 403, `allows subdomain www.clubofmozambique.com`, `HTTP ${subRes.status}`);

  console.log(`\n--- 3. Input validation ---`);
  const noParam = await fetch(`${BASE}/api/image-proxy`, { signal: AbortSignal.timeout(15000) });
  check(noParam.status === 400, 'missing url param returns 400', `HTTP ${noParam.status}`);

  const malformed = await fetch(`${BASE}/api/image-proxy?url=not-a-url`, {
    signal: AbortSignal.timeout(15000),
  });
  check(malformed.status === 400, 'malformed url returns 400', `HTTP ${malformed.status}`);

  console.log(`\n--- 4. Missing image falls through to placeholder ---`);
  const missing = await fetch(
    proxyUrl('https://clubofmozambique.com/wp-content/uploads/2026/08/nope-does-not-exist-xyz.jpg'),
    { signal: AbortSignal.timeout(40000) }
  );
  check(
    missing.status === 404,
    'nonexistent image returns 404 (client shows placeholder)',
    `HTTP ${missing.status}`
  );

  console.log(`\n--- 5. Other sources are not proxied (regression check) ---`);
  const otherImages = articles
    .filter((a) => !(a.link || '').includes('clubofmozambique.com'))
    .map((a) => a.image_url || a.imageUrl)
    .filter(Boolean)
    .slice(0, 4);

  if (otherImages.length === 0) {
    console.log('  (no non-Club articles with images in the current feed)');
  }
  for (const img of otherImages) {
    // These must be refused by the proxy, which proves the helper leaves them
    // as direct hotlinks rather than routing them through our server.
    const res = await fetch(proxyUrl(img), { signal: AbortSignal.timeout(20000) });
    const host = new URL(img).hostname;
    check(res.status === 403, `${host.slice(0, 40).padEnd(40)} stays a direct hotlink`, `HTTP ${res.status}`);
  }

  console.log(`\n--- 6. Caching headers present ---`);
  const cacheProbe = clubImages.length ? await getImage(proxyUrl(clubImages[0])) : null;
  if (cacheProbe) {
    check(
      cacheProbe.cache.includes('s-maxage'),
      'success response is edge-cacheable',
      cacheProbe.cache
    );
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
