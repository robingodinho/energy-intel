/**
 * Keyword-Based Article Categorization
 * 
 * Deterministic categorization based on keyword matching.
 * AI is NOT used for categorization (only for summarization).
 * 
 * Categories:
 * - LNG: Liquefied natural gas related content
 * - Renewable Energy: Solar, wind, hydro, storage, hydrogen
 * - Energy Policy: Regulations, legislation, agencies
 * - Emissions: Carbon, climate, pollution, decarbonization
 * - Infrastructure: Grid, transmission, utilities, power plants
 */

import { ArticleCategory } from '@/types/article';

/**
 * Keyword patterns for each category
 * 
 * Keywords are matched case-insensitively against article title and content.
 * Order matters - first match wins (more specific categories checked first).
 */
interface CategoryKeywords {
  category: ArticleCategory;
  keywords: string[];
  // Higher weight keywords that strongly indicate this category
  strongKeywords: string[];
}

const CATEGORY_PATTERNS: CategoryKeywords[] = [
  {
    category: 'LNG',
    strongKeywords: [
      'lng',
      'liquefied natural gas',
      'gas export terminal',
      'gas import terminal',
      'regasification',
      'liquefaction plant',
      'lng tanker',
      'lng carrier',
      'lng facility',
      'lng project',
    ],
    keywords: [
      'natural gas export',
      'natural gas import',
      'gas terminal',
      'gas pipeline',
      'methane terminal',
      'floating lng',
      'flng',
      'fsru',
      'cryogenic',
      'gas storage facility',
      'gas processing',
    ],
  },
  {
    category: 'Renewable Energy',
    strongKeywords: [
      'solar power',
      'solar energy',
      'wind power',
      'wind energy',
      'wind farm',
      'solar farm',
      'offshore wind',
      'onshore wind',
      'renewable energy',
      'clean energy',
      'green energy',
      'photovoltaic',
      'wind turbine',
      'solar panel',
      'battery storage',
      'energy storage',
      'green hydrogen',
      'electrolysis',
      'hydropower',
      'geothermal',
    ],
    keywords: [
      'solar',
      'wind',
      'renewable',
      'biomass',
      'biofuel',
      'biogas',
      'hydroelectric',
      'tidal power',
      'wave energy',
      'fuel cell',
      'hydrogen production',
      'electrolyzer',
      'battery',
      'lithium-ion',
      'storage system',
      'grid storage',
      'utility-scale solar',
      'utility-scale wind',
      'distributed generation',
      'rooftop solar',
      'pv system',
      'inverter',
      'net metering',
      'renewable portfolio',
      'rps',
      'clean power',
      'zero-emission',
      'hybrid renewables',
    ],
  },
  {
    category: 'Emissions',
    strongKeywords: [
      'carbon emissions',
      'greenhouse gas',
      'ghg emissions',
      'carbon capture',
      'carbon sequestration',
      'decarbonization',
      'decarbonize',
      'net zero',
      'net-zero',
      'carbon neutral',
      'climate change',
      'climate action',
      'carbon tax',
      'cap and trade',
      'emissions reduction',
      'methane emissions',
      'co2 emissions',
    ],
    keywords: [
      'emissions',
      'carbon',
      'pollution',
      'pollutant',
      'air quality',
      'environmental',
      'carbon footprint',
      'carbon dioxide',
      'co2',
      'ch4',
      'nitrous oxide',
      'sulfur dioxide',
      'particulate',
      'ozone',
      'clean air',
      'epa regulation',
      'emission standard',
      'carbon intensity',
      'carbon credit',
      'carbon offset',
      'climate',
      'global warming',
      'paris agreement',
      'cop28',
      'cop29',
      'sustainability',
      'sustainable',
      'esg',
      'environmental impact',
    ],
  },
  {
    category: 'Infrastructure',
    strongKeywords: [
      'transmission line',
      'power grid',
      'electric grid',
      'grid infrastructure',
      'grid reliability',
      'grid resilience',
      'transmission infrastructure',
      'distribution infrastructure',
      'power plant',
      'substation',
      'interconnection',
      'grid modernization',
      'smart grid',
      'grid upgrade',
      'transformer',
      'high-voltage',
      'hvdc',
    ],
    keywords: [
      'grid',
      'transmission',
      'distribution',
      'utility',
      'power line',
      'powerline',
      'capacity',
      'generation capacity',
      'baseload',
      'peak demand',
      'load balancing',
      'blackout',
      'outage',
      'brownout',
      'reliability',
      'resilience',
      'cybersecurity',
      'critical infrastructure',
      'electric utility',
      'power utility',
      'rate case',
      'tariff',
      'interconnect',
      'ferc order',
      'nerc',
      'ercot',
      'pjm',
      'caiso',
      'miso',
      'spp',
      'iso-ne',
      'nyiso',
      'rto',
      'iso',
      'voltage',
      'frequency',
      'ancillary services',
      'demand response',
      'dso',
      'tso',
    ],
  },
  {
    category: 'Energy Policy',
    strongKeywords: [
      'energy policy',
      'energy regulation',
      'energy legislation',
      'ferc ruling',
      'epa ruling',
      'doe announcement',
      'energy bill',
      'energy act',
      'regulatory approval',
      'regulatory framework',
      'energy mandate',
      'energy standard',
      'federal energy',
      'state energy',
      'energy commission',
    ],
    keywords: [
      'policy',
      'regulation',
      'regulatory',
      'legislation',
      'bill',
      'act',
      'congress',
      'senate',
      'house of representatives',
      'ferc',
      'epa',
      'doe',
      'eia',
      'rulemaking',
      'compliance',
      'mandate',
      'federal',
      'law',
      'executive order',
      'administration',
      'secretary',
      'commissioner',
      'hearing',
      'docket',
      'filing',
      'petition',
      'permit',
      'licensing',
      'approval',
      'review',
      'assessment',
      'stakeholder',
      'public comment',
      'industry leaders',
      'power industry',
      'energy industry',
      'energy sector',
      'market',
      'wholesale market',
      'electricity market',
      'price',
      'cost',
      'investment',
      'funding',
      'grant',
      'subsidy',
      'incentive',
      'tax credit',
      'itc',
      'ptc',
      'ira',
      'inflation reduction act',
      'bipartisan',
      'workforce',
    ],
  },
];

/**
 * Calculate match score for a category
 * 
 * @param text - Combined title and content text to analyze
 * @param patterns - Category keyword patterns
 * @returns Score (higher = better match)
 */
function calculateCategoryScore(text: string, patterns: CategoryKeywords): number {
  const lowerText = text.toLowerCase();
  let score = 0;

  // Strong keywords are worth 3 points each
  for (const keyword of patterns.strongKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += 3;
    }
  }

  // Regular keywords are worth 1 point each
  for (const keyword of patterns.keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += 1;
    }
  }

  return score;
}

/**
 * Categorize an article based on its title and content
 * 
 * Uses keyword matching with weighted scoring.
 * Falls back to 'Energy Policy' if no strong matches.
 * 
 * @param title - Article title
 * @param content - Article content/summary (optional)
 * @returns Best matching category
 */
export function categorizeArticle(
  title: string,
  content?: string
): ArticleCategory {
  // Combine title and content for analysis
  // Title is more important, so we include it twice
  const text = `${title} ${title} ${content || ''}`;

  // Calculate scores for each category
  const scores: { category: ArticleCategory; score: number }[] = 
    CATEGORY_PATTERNS.map((patterns) => ({
      category: patterns.category,
      score: calculateCategoryScore(text, patterns),
    }));

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Return the highest scoring category, or 'Energy Policy' as default
  const bestMatch = scores[0];
  
  // Require at least a score of 1 to assign a non-default category
  if (bestMatch && bestMatch.score >= 1) {
    return bestMatch.category;
  }

  // Default to 'Energy Policy' for general energy news
  return 'Energy Policy';
}

/**
 * Get category with debug information
 * 
 * Useful for testing and understanding categorization decisions.
 * 
 * @param title - Article title
 * @param content - Article content (optional)
 * @returns Category and scoring details
 */
export function categorizeArticleWithDetails(
  title: string,
  content?: string
): {
  category: ArticleCategory;
  scores: { category: ArticleCategory; score: number }[];
  matchedKeywords: { category: ArticleCategory; keywords: string[] }[];
} {
  const text = `${title} ${title} ${content || ''}`;
  const lowerText = text.toLowerCase();

  const scores: { category: ArticleCategory; score: number }[] = [];
  const matchedKeywords: { category: ArticleCategory; keywords: string[] }[] = [];

  for (const patterns of CATEGORY_PATTERNS) {
    let score = 0;
    const matched: string[] = [];

    for (const keyword of patterns.strongKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 3;
        matched.push(`[STRONG] ${keyword}`);
      }
    }

    for (const keyword of patterns.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 1;
        matched.push(keyword);
      }
    }

    scores.push({ category: patterns.category, score });
    if (matched.length > 0) {
      matchedKeywords.push({ category: patterns.category, keywords: matched });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  const bestMatch = scores[0];
  const category = bestMatch && bestMatch.score >= 1 ? bestMatch.category : 'Energy Policy';

  return { category, scores, matchedKeywords };
}

/**
 * Get all available categories
 */
export function getAllCategories(): ArticleCategory[] {
  return ['LNG', 'Renewable Energy', 'Energy Policy', 'Emissions', 'Infrastructure'];
}

