import { FeedSource } from '@/types/article';

/**
 * RSS Feed Sources for U.S. Energy Intelligence Platform
 * 
 * Sources are organized by category:
 * 1. Official Government Sources (primary)
 * 2. Industry Trade Publications
 * 3. News Wire Services
 * 4. Specialty/Sector Publications
 * 
 * IMPORTANT:
 * - New sources should be added with `enabled: false`
 * - Validate each source with `npm run test:feeds` before enabling
 * - Check HTTP status + Content-Type to debug failures
 * 
 * Last validated: 2026-01-04
 * Working sources: EIA, DOE, Utility Dive, Renewable Energy World, Power Magazine, Energy Storage News
 */

// =============================================================================
// OFFICIAL GOVERNMENT SOURCES (Primary - High Trust)
// =============================================================================

const GOVERNMENT_SOURCES: FeedSource[] = [
  {
    name: 'EIA',
    url: 'https://www.eia.gov/rss/todayinenergy.xml',
    enabled: true,
    // ✅ Verified working - Energy Information Administration
    // Returns ~21 items, updated daily
  },
  {
    name: 'DOE',
    url: 'https://www.energy.gov/rss.xml',
    enabled: true,
    // ✅ Verified working - Department of Energy
    // Returns ~10 items
  },
  {
    name: 'FERC',
    url: 'https://www.ferc.gov/news-events/news/rss.xml',
    enabled: false,
    // ❌ Returns 403 Forbidden (Cloudflare protection)
    // TODO: Investigate alternative access method
  },
  {
    name: 'EPA',
    url: 'https://www.epa.gov/newsreleases/search/rss',
    enabled: false,
    // ❌ Returns HTML, not valid RSS
    // TODO: Find correct EPA RSS feed URL
  },
];

// =============================================================================
// INDUSTRY TRADE PUBLICATIONS (Verified Working)
// =============================================================================

const TRADE_SOURCES: FeedSource[] = [
  {
    name: 'Utility Dive',
    url: 'https://www.utilitydive.com/feeds/news/',
    enabled: true,
    // ✅ Verified working - 10 items
    // Industry news for electric, gas, and water utilities
    // Focus: Grid modernization, regulation, utility business
  },
  {
    name: 'Renewable Energy World',
    url: 'https://www.renewableenergyworld.com/feed/',
    enabled: true,
    // ✅ Verified working - 10 items
    // Renewable energy industry news
    // Focus: Solar, wind, storage, grid integration
  },
  {
    name: 'Power Magazine',
    url: 'https://www.powermag.com/feed/',
    enabled: true,
    // ✅ Verified working - 10 items
    // Electric power generation industry
    // Focus: Power plants, generation technology
  },
  {
    name: 'Energy Storage News',
    url: 'https://www.energy-storage.news/feed/',
    enabled: true,
    // ✅ Verified working - 50 items
    // Battery and energy storage industry
    // Focus: Grid storage, EV batteries, technology
  },
  {
    name: 'Oil & Gas Journal',
    url: 'https://www.ogj.com/rss',
    enabled: false,
    // ❌ Returns HTML (bot protection)
    // Leading petroleum industry publication
  },
];

// =============================================================================
// NEWS WIRE SERVICES & MAJOR OUTLETS (Access Issues)
// =============================================================================

const NEWS_SOURCES: FeedSource[] = [
  {
    name: 'Reuters Energy',
    url: 'https://www.reutersagency.com/feed/?best-topics=energy&post_type=best',
    enabled: false,
    // ❌ Returns 404 Not Found
    // TODO: Find correct Reuters energy RSS URL
  },
  {
    name: 'S&P Global Energy',
    url: 'https://www.spglobal.com/commodityinsights/en/rss-feed/energy',
    enabled: false,
    // ❌ Returns 403 Forbidden
    // S&P Global Commodity Insights (formerly Platts)
  },
];

// =============================================================================
// INTERNATIONAL / RESEARCH ORGANIZATIONS (Access Issues)
// =============================================================================

const INTERNATIONAL_SOURCES: FeedSource[] = [
  {
    name: 'IEA',
    url: 'https://www.iea.org/rss/news.xml',
    enabled: false,
    // ❌ Returns 403 Forbidden (Cloudflare protection)
    // International Energy Agency
  },
  {
    name: 'IRENA',
    url: 'https://www.irena.org/rss',
    enabled: false,
    // ❌ Returns 404 HTML page
    // International Renewable Energy Agency
  },
];

// =============================================================================
// FINANCE & MARKET NEWS SOURCES
// =============================================================================

const FINANCE_SOURCES: FeedSource[] = [
  {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    enabled: true,
    articleType: 'finance',
    // ✅ Yahoo Finance RSS - General financial news
    // Good coverage of market movements, earnings, economic data
  },
  {
    name: 'CNBC Energy',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19836768',
    enabled: true,
    articleType: 'finance',
    // ✅ CNBC Energy RSS - Energy sector financial news
    // Focus: Oil prices, energy stocks, commodities
  },
  {
    name: 'Reuters Business',
    url: 'https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best',
    enabled: false,
    articleType: 'finance',
    // ❌ May require validation - Reuters business/sector news
  },
  {
    name: 'MarketWatch Energy',
    url: 'https://feeds.marketwatch.com/marketwatch/realtimeheadlines/',
    enabled: false,
    articleType: 'finance',
    // ❌ May require validation - MarketWatch real-time headlines
  },
  {
    name: 'Mozambique Energy (Google News)',
    url: 'https://news.google.com/rss/search?q=Mozambique%20energy',
    enabled: true,
    articleType: 'finance',
    // Broad Mozambique energy coverage via Google News
  },
  {
    name: 'Mozambique LNG Finance (Google News)',
    url: 'https://news.google.com/rss/search?q=Mozambique%20gas%20LNG%20energy%20finance',
    enabled: true,
    articleType: 'finance',
    // More finance-focused Mozambique LNG/energy items via Google News
  },
  {
    name: 'Club of Mozambique',
    url: 'https://clubofmozambique.com/feed/',
    enabled: true,
    articleType: 'finance',
    // General Mozambique news; pipeline filtering + categorization will keep energy items
  },
  {
    name: 'ESI Africa Mozambique',
    url: 'https://www.esi-africa.com/tag/mozambique/feed/',
    enabled: false,
    articleType: 'finance',
    // Enable after verifying availability; focused on power/energy sector
  },
  {
    name: 'Engineering News Energy',
    url: 'https://www.engineeringnews.co.za/page/energy/feed',
    enabled: false,
    articleType: 'finance',
    // Not Mozambique-only; can be title-filtered later for Mozambique if needed
  },
];

// =============================================================================
// COMBINED FEED LIST
// =============================================================================

export const FEED_SOURCES: FeedSource[] = [
  ...GOVERNMENT_SOURCES,
  ...TRADE_SOURCES,
  ...NEWS_SOURCES,
  ...INTERNATIONAL_SOURCES,
  ...FINANCE_SOURCES,
];

/**
 * Get all enabled feed sources
 */
export function getEnabledFeeds(): FeedSource[] {
  return FEED_SOURCES.filter((feed) => feed.enabled);
}

/**
 * Get all feed sources (including disabled)
 */
export function getAllFeeds(): FeedSource[] {
  return FEED_SOURCES;
}

/**
 * Get a feed source by name
 */
export function getFeedByName(name: string): FeedSource | undefined {
  return FEED_SOURCES.find((feed) => feed.name === name);
}

/**
 * Get feeds by category
 */
export function getFeedsByCategory(category: 'government' | 'trade' | 'news' | 'international' | 'finance'): FeedSource[] {
  switch (category) {
    case 'government':
      return GOVERNMENT_SOURCES;
    case 'trade':
      return TRADE_SOURCES;
    case 'news':
      return NEWS_SOURCES;
    case 'international':
      return INTERNATIONAL_SOURCES;
    case 'finance':
      return FINANCE_SOURCES;
    default:
      return [];
  }
}

/**
 * Get enabled feeds by article type
 */
export function getEnabledFeedsByType(articleType: 'policy' | 'finance'): FeedSource[] {
  return FEED_SOURCES.filter((feed) => {
    if (!feed.enabled) return false;
    const feedType = feed.articleType || 'policy';
    return feedType === articleType;
  });
}

/**
 * Get enabled finance feeds
 */
export function getEnabledFinanceFeeds(): FeedSource[] {
  return getEnabledFeedsByType('finance');
}
