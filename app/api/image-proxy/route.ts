import { NextRequest, NextResponse } from 'next/server';
import { isChallengedImageHost } from '@/lib/imageProxy';

/**
 * GET /api/image-proxy?url=<encoded image url>
 *
 * Serves cover images for sources whose CDN is behind a Cloudflare managed
 * challenge (see lib/imageProxy.ts). The visitor's browser cannot fetch those
 * images directly, so we fetch them here and re-serve the bytes.
 *
 * Two attempts, in order:
 *   1. Direct fetch. Cheap, and keeps working if the source ever drops the
 *      challenge.
 *   2. DuckDuckGo's image proxy, whose crawler is not challenged by
 *      Cloudflare. This is what actually succeeds today.
 *
 * Responses carry a long s-maxage so Vercel's CDN absorbs repeat views and
 * the upstream is hit roughly once per image.
 */

const isDev = process.env.NODE_ENV !== 'production';

// Image bytes at a given URL don't change, so cache hard at the edge.
const SUCCESS_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800';

// Cache failures briefly so a broken image can't turn into a request loop,
// but not so long that a transient upstream blip sticks around.
const FAILURE_CACHE_CONTROL = 'public, max-age=60, s-maxage=300';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function failure(status: number, reason: string): NextResponse {
  return NextResponse.json(
    { error: reason },
    { status, headers: { 'Cache-Control': FAILURE_CACHE_CONTROL } }
  );
}

/**
 * Fetch an image and hand back the streaming body, or null if the response
 * isn't a usable image.
 */
async function fetchImage(
  target: string,
  timeoutMs: number
): Promise<{ body: ReadableStream<Uint8Array>; contentType: string } | null> {
  try {
    const response = await fetch(target, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok || !response.body) return null;

    // A challenge page returns 403 with text/html, so this check is what
    // distinguishes a real image from an interstitial.
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_IMAGE_BYTES) return null;

    return { body: response.body, contentType };
  } catch {
    return null;
  }
}

function duckDuckGoProxyUrl(imageUrl: string): string {
  return `https://external-content.duckduckgo.com/iu/?u=${encodeURIComponent(
    imageUrl
  )}&f=1&nofb=1&ipt=1`;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');

  if (!rawUrl) {
    return failure(400, 'Missing url parameter');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return failure(400, 'Malformed url parameter');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return failure(400, 'Unsupported protocol');
  }

  // Allowlist check: without this the endpoint would be an open proxy that
  // could be pointed at internal addresses or used to relay arbitrary traffic.
  if (!isChallengedImageHost(parsed.hostname)) {
    return failure(403, 'Host not allowed');
  }

  const direct = await fetchImage(parsed.href, 8000);
  const image = direct ?? (await fetchImage(duckDuckGoProxyUrl(parsed.href), 15000));

  if (!image) {
    if (isDev) {
      console.warn(`[image-proxy] Could not retrieve ${parsed.href.slice(0, 100)}`);
    }
    // 404 lets the client's onError chain fall through to a placeholder.
    return failure(404, 'Image unavailable');
  }

  if (isDev) {
    console.log(
      `[image-proxy] Served ${parsed.href.slice(0, 70)} via ${direct ? 'direct' : 'duckduckgo'}`
    );
  }

  return new NextResponse(image.body, {
    status: 200,
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': SUCCESS_CACHE_CONTROL,
      'X-Image-Source': direct ? 'direct' : 'duckduckgo',
    },
  });
}
