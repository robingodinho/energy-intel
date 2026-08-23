/**
 * Diagnostic for Club of Mozambique cover images.
 *
 * This has broken twice for two different reasons, so the first question to
 * answer is always which half of the pipeline failed:
 *
 *   - image_url is NULL in the database  -> scraping/ingestion problem
 *   - image_url is present but no image  -> delivery problem
 *
 * Step 1 below answers that. Steps 2-5 then test each route we depend on.
 *
 * Usage: node scripts/diagnose-club-images.mjs
 */

const SITE = process.env.DIAG_SITE || 'https://enerva.ai';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function label(ok) {
  return ok ? 'OK ' : 'FAIL';
}

async function getProductionArticles() {
  const res = await fetch(`${SITE}/api/finance/articles?limit=100`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`articles API HTTP ${res.status}`);
  const data = await res.json();
  return data.articles || [];
}

async function tryDirect(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const html = await res.text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    return { ok: !!m, detail: m ? m[1] : `200 but no og:image (${html.length} bytes)` };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

async function tryOembed(url) {
  try {
    const origin = new URL(url).origin;
    const res = await fetch(`${origin}/wp-json/oembed/1.0/embed?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const json = await res.json();
    return {
      ok: typeof json.thumbnail_url === 'string',
      detail: json.thumbnail_url || 'no thumbnail_url in response',
    };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

async function tryWpPosts(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const slug = parts[parts.length - 1];
    const res = await fetch(
      `${parsed.origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia`,
      {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      return { ok: false, detail: 'no post matched slug' };
    }
    const media = posts[0]?._embedded?.['wp:featuredmedia'];
    const src = Array.isArray(media) ? media[0]?.source_url : undefined;
    return { ok: !!src, detail: src || 'post found but no featured media' };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

async function tryDuckDuckGo(imageUrl) {
  try {
    const res = await fetch(
      `https://external-content.duckduckgo.com/iu/?u=${encodeURIComponent(imageUrl)}&f=1&nofb=1&ipt=1`,
      {
        headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(25000),
      }
    );
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const ct = res.headers.get('content-type') || '-';
    const buf = await res.arrayBuffer();
    const ok = ct.startsWith('image/') && buf.byteLength > 1500;
    return { ok, detail: `${ct} ${buf.byteLength}B` };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

async function tryOurProxy(imageUrl) {
  try {
    const res = await fetch(`${SITE}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`, {
      headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    const ct = res.headers.get('content-type') || '-';
    if (!res.ok) {
      // Our handler answers with JSON; an HTML 404 means the route itself
      // isn't deployed to this environment yet.
      const notDeployed = res.status === 404 && !ct.includes('application/json');
      return {
        ok: false,
        detail: notDeployed ? 'route not deployed to this environment yet' : `HTTP ${res.status}`,
      };
    }
    const via = res.headers.get('x-image-source') || '-';
    const buf = await res.arrayBuffer();
    const ok = ct.startsWith('image/') && buf.byteLength > 1500;
    return { ok, detail: `${ct} ${buf.byteLength}B via=${via}` };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

async function tryMicrolink(url) {
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    const bodyText = await res.text();
    let json;
    try {
      json = JSON.parse(bodyText);
    } catch {
      return { ok: false, detail: `HTTP ${res.status}, non-JSON: ${bodyText.slice(0, 120)}` };
    }
    if (!res.ok) {
      return {
        ok: false,
        detail: `HTTP ${res.status} status=${json.status} ${json.message || json.code || ''}`.trim(),
      };
    }
    if (json.status !== 'success') {
      return { ok: false, detail: `status=${json.status} ${json.message || ''}`.trim() };
    }
    const img = json.data?.image?.url || json.data?.screenshot?.url;
    return { ok: !!img, detail: img || 'success but no image field' };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

const run = async () => {
  console.log(`\n=== Club of Mozambique image diagnostic ===`);
  console.log(`Site: ${SITE}\n`);

  let articles = [];
  try {
    articles = await getProductionArticles();
  } catch (err) {
    console.log(`Could not reach production articles API: ${err.message}`);
  }

  const club = articles.filter((a) => (a.link || '').includes('clubofmozambique.com'));
  console.log(`--- Step 1: production DB state ---`);
  console.log(`Total articles returned: ${articles.length}`);
  console.log(`Club of Mozambique articles: ${club.length}`);

  const withImage = club.filter((a) => a.image_url || a.imageUrl);
  console.log(`  with a stored image_url: ${withImage.length}`);
  console.log(`  missing image_url:       ${club.length - withImage.length}`);

  for (const a of club.slice(0, 6)) {
    const img = a.image_url || a.imageUrl || null;
    console.log(`   - ${(a.title || '').slice(0, 58)}`);
    console.log(`     image_url: ${img ? String(img).slice(0, 95) : 'NULL (placeholder shown)'}`);
  }

  console.log(`\n--- Step 2: can the stored images actually be delivered? ---`);
  const storedImages = club.map((a) => a.image_url || a.imageUrl).filter(Boolean).slice(0, 3);
  for (const imgUrl of storedImages) {
    console.log(`\nImage: ${imgUrl.split('/').pop().slice(0, 70)}`);
    const ddg = await tryDuckDuckGo(imgUrl);
    console.log(`  [${label(ddg.ok)}] DuckDuckGo image proxy    ${ddg.detail.slice(0, 90)}`);
    const proxied = await tryOurProxy(imgUrl);
    console.log(`  [${label(proxied.ok)}] our /api/image-proxy      ${proxied.detail.slice(0, 90)}`);
  }

  const sample = club.slice(0, 3).map((a) => a.link);
  if (sample.length === 0) {
    console.log(`\nNo Club of Mozambique articles found; using a known URL for reachability tests.`);
    sample.push('https://clubofmozambique.com/news/');
  }

  console.log(`\n--- Step 3: scraping routes, tested from this machine ---`);
  for (const url of sample) {
    console.log(`\nArticle: ${url.slice(0, 100)}`);
    const direct = await tryDirect(url);
    console.log(`  [${label(direct.ok)}] direct fetch + og:image   ${direct.detail.slice(0, 110)}`);
    const oembed = await tryOembed(url);
    console.log(`  [${label(oembed.ok)}] wp-json oEmbed            ${oembed.detail.slice(0, 110)}`);
    const wp = await tryWpPosts(url);
    console.log(`  [${label(wp.ok)}] wp-json posts+media       ${wp.detail.slice(0, 110)}`);
    const micro = await tryMicrolink(url);
    console.log(`  [${label(micro.ok)}] Microlink                 ${micro.detail.slice(0, 110)}`);
  }

  console.log(`\nHow to read this:`);
  console.log(`  As of Aug 2026 Cloudflare serves a managed JS challenge for every`);
  console.log(`  clubofmozambique.com asset, so all of the Step 3 routes are expected`);
  console.log(`  to FAIL. Image URLs come from the RSS feed itself, and delivery goes`);
  console.log(`  through /api/image-proxy. So the row that matters is Step 2.`);
  console.log(`  If Step 2 fails, the DuckDuckGo route has stopped working and the`);
  console.log(`  proxy needs another upstream added in app/api/image-proxy/route.ts.\n`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
