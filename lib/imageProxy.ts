/**
 * Image delivery for hosts behind a Cloudflare JS challenge.
 *
 * Some sources (Club of Mozambique) sit behind a Cloudflare managed challenge
 * that applies to every asset on the domain, including files under
 * /wp-content/uploads. Requests without a solved challenge cookie get a
 * "Just a moment..." interstitial with `cf-mitigated: challenge` and HTTP 403.
 *
 * That breaks hotlinking outright: the article's image URL is correct and
 * stored fine, but the visitor's browser cannot load it, so the card falls
 * through to a category placeholder. It also can't be fixed by scraping
 * differently, because the URL was never the problem.
 *
 * For these hosts we route the image through our own /api/image-proxy, which
 * fetches the bytes server-side and re-serves them from our domain.
 *
 * The host list doubles as the proxy's allowlist, so keep it narrow: it is
 * what stops the endpoint from becoming an open image proxy.
 */
const CHALLENGED_IMAGE_HOSTS = ['clubofmozambique.com'];

/**
 * True when `hostname` is an allowlisted host or one of its subdomains.
 */
export function isChallengedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return CHALLENGED_IMAGE_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

/**
 * True when a URL should be served through our proxy instead of hotlinked.
 */
export function needsImageProxy(url: string): boolean {
  if (!url || url.startsWith('/')) return false;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return isChallengedImageHost(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Rewrite a challenged-host image URL to our proxy. Any other URL (including
 * local placeholders) is returned unchanged, so this is safe to apply to
 * every image on the page.
 */
export function toDeliverableImageUrl(url: string): string {
  if (!needsImageProxy(url)) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}
