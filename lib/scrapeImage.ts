/**
 * OpenGraph/Twitter Card Image Scraper
 * 
 * Fetches article HTML and extracts cover image URL from meta tags.
 * Enhanced with multiple fallback strategies for sites without OG tags.
 */

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Result of scraping an article for its cover image
 */
export interface ScrapeResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

/**
 * User agents to rotate through (realistic browser UAs)
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

/**
 * Get a random user agent
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Extract image URL from HTML content with multiple fallbacks
 * 
 * Priority:
 * 1. og:image
 * 2. twitter:image / twitter:image:src
 * 3. link rel="image_src"
 * 4. Schema.org JSON-LD image
 * 5. First large image in article/main content
 */
function extractImageFromHtml(html: string, baseUrl: string): string | null {
  // 1. OpenGraph image
  const ogPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ];
  
  for (const pattern of ogPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const resolved = resolveImageUrl(match[1].trim(), baseUrl);
      if (resolved && isLikelyGoodImage(resolved)) return resolved;
    }
  }

  // 2. Twitter Card image
  const twitterPatterns = [
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<meta[^>]+property=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']twitter:image["']/i,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image:src["']/i,
  ];
  
  for (const pattern of twitterPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const resolved = resolveImageUrl(match[1].trim(), baseUrl);
      if (resolved && isLikelyGoodImage(resolved)) return resolved;
    }
  }

  // 3. Link rel="image_src" (legacy but still used)
  const linkPattern = /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i;
  const linkMatch = html.match(linkPattern);
  if (linkMatch && linkMatch[1]) {
    const resolved = resolveImageUrl(linkMatch[1].trim(), baseUrl);
    if (resolved && isLikelyGoodImage(resolved)) return resolved;
  }

  // 4. Schema.org JSON-LD image
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch;
  while ((jsonLdMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const jsonContent = jsonLdMatch[1];
      const data = JSON.parse(jsonContent);
      const imageUrl = extractSchemaImage(data);
      if (imageUrl) {
        const resolved = resolveImageUrl(imageUrl, baseUrl);
        if (resolved && isLikelyGoodImage(resolved)) return resolved;
      }
    } catch {
      // Invalid JSON, continue
    }
  }

  // 5. Look for featured image patterns common in articles
  const featuredPatterns = [
    // WordPress featured image
    /<img[^>]+class=["'][^"']*wp-post-image[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*wp-post-image[^"']*["']/i,
    // Article/post images
    /<img[^>]+class=["'][^"']*featured[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+class=["'][^"']*hero[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+class=["'][^"']*post-image[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+class=["'][^"']*article-image[^"']*["'][^>]+src=["']([^"']+)["']/i,
    // First image in article content
    /<article[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
    /<main[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
    /<div[^>]+class=["'][^"']*content[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
  ];

  for (const pattern of featuredPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const resolved = resolveImageUrl(match[1].trim(), baseUrl);
      if (resolved && isLikelyGoodImage(resolved)) return resolved;
    }
  }

  // 6. Last resort: first substantial img tag
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    const src = imgMatch[1].trim();
    const resolved = resolveImageUrl(src, baseUrl);
    if (resolved && isLikelyGoodImage(resolved)) {
      return resolved;
    }
  }

  return null;
}

/**
 * Extract image from Schema.org JSON-LD data
 */
function extractSchemaImage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;
  
  // Handle arrays (multiple schemas)
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const img = extractSchemaImage(item);
      if (img) return img;
    }
    return null;
  }

  // Check for image property
  if (obj.image) {
    if (typeof obj.image === 'string') return obj.image;
    if (Array.isArray(obj.image) && obj.image[0]) {
      const first = obj.image[0];
      if (typeof first === 'string') return first;
      if (typeof first === 'object' && first && 'url' in first) {
        return (first as Record<string, unknown>).url as string;
      }
    }
    if (typeof obj.image === 'object' && obj.image && 'url' in obj.image) {
      return (obj.image as Record<string, unknown>).url as string;
    }
  }

  // Check for thumbnailUrl
  if (typeof obj.thumbnailUrl === 'string') return obj.thumbnailUrl;

  return null;
}

/**
 * Check if URL looks like a good content image (not icons, logos, etc.)
 */
function isLikelyGoodImage(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  
  // Skip common non-content images
  const skipPatterns = [
    'favicon', 'logo', 'icon', 'sprite', 'pixel', 
    'tracking', 'analytics', 'badge', 'button',
    '1x1', 'spacer', 'blank', 'transparent',
    'avatar', 'profile', 'author', 'gravatar',
    '.gif', // Often tracking pixels or animations
  ];
  
  for (const pattern of skipPatterns) {
    if (lowerUrl.includes(pattern)) return false;
  }

  // Must have a recognizable image extension or look like an image URL
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
  const hasImageExt = imageExtensions.some(ext => lowerUrl.includes(ext));
  const looksLikeImage = lowerUrl.includes('/image') || 
                         lowerUrl.includes('/img') ||
                         lowerUrl.includes('/photo') ||
                         lowerUrl.includes('/media') ||
                         lowerUrl.includes('/uploads') ||
                         lowerUrl.includes('/wp-content');

  return hasImageExt || looksLikeImage;
}

/**
 * Resolve and validate image URL
 */
function resolveImageUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    // Skip data URLs
    if (rawUrl.startsWith('data:')) {
      return null;
    }

    // Resolve relative URLs
    const resolved = new URL(rawUrl, baseUrl);

    // Only allow http/https
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }

    // Return the resolved absolute URL
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Scrape OpenGraph/Twitter image from an article URL
 * 
 * @param articleUrl - The article page URL to scrape
 * @returns ScrapeResult with imageUrl or error
 */
export async function scrapeArticleImage(articleUrl: string): Promise<ScrapeResult> {
  try {
    // Validate URL
    const url = new URL(articleUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { success: false, error: 'Invalid protocol' };
    }

    // Fetch the page
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    // Check response
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { success: false, error: 'Not HTML content' };
    }

    // Get HTML (limit to first 100KB to find images in content)
    const html = await response.text();
    const limitedHtml = html.slice(0, 100000);

    // Extract image URL
    const imageUrl = extractImageFromHtml(limitedHtml, articleUrl);

    if (imageUrl) {
      if (isDev) {
        console.log(`[scrapeImage] Found image for ${articleUrl.slice(0, 50)}: ${imageUrl.slice(0, 80)}`);
      }
      return { success: true, imageUrl };
    }

    return { success: false, error: 'No image found' };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    if (isDev) {
      console.warn(`[scrapeImage] Error scraping ${articleUrl.slice(0, 50)}: ${errorMsg}`);
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Batch scrape images for multiple articles
 * 
 * @param articles - Array of articles with id and link
 * @param delayMs - Delay between requests to be polite (default 500ms)
 * @returns Map of article id -> image URL (or null if failed)
 */
export async function scrapeArticleImages(
  articles: { id: string; link: string }[],
  delayMs: number = 500
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const result = await scrapeArticleImage(article.link);
    
    results.set(article.id, result.success ? result.imageUrl! : null);

    // Small delay between requests to be polite
    if (i < articles.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
