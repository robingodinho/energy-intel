/**
 * Article Types
 * 
 * These types match the Supabase `articles` table schema exactly.
 * Field names use snake_case to match database columns.
 */

/**
 * Category union type
 * 
 * Articles are categorized into one of these five domains.
 * Categorization is deterministic (keyword-based), not AI-driven.
 */
export type ArticleCategory =
  | 'LNG'
  | 'Renewable Energy'
  | 'Energy Policy'
  | 'Emissions'
  | 'Infrastructure';

/**
 * Full article row as stored in the database
 * 
 * Matches Supabase `articles` table schema:
 * - id: TEXT PRIMARY KEY
 * - title: TEXT NOT NULL
 * - summary: TEXT NOT NULL
 * - link: TEXT NOT NULL
 * - pub_date: TIMESTAMP NOT NULL
 * - source: TEXT NOT NULL
 * - category: TEXT NOT NULL
 * - article_type: TEXT DEFAULT 'policy'
 * - image_url: TEXT NULL (OpenGraph/Twitter card image)
 * - created_at: TIMESTAMP DEFAULT NOW()
 */
export interface ArticleRow {
  id: string;
  title: string;
  summary: string;
  link: string;
  pub_date: string;      // ISO 8601 timestamp string
  source: string;        // e.g., 'FERC', 'EPA', 'DOE', 'EIA'
  category: ArticleCategory;
  article_type?: ArticleType; // 'policy' or 'finance'
  image_url?: string | null;  // OpenGraph/Twitter card image URL
  created_at: string;    // ISO 8601 timestamp string (auto-generated)
}

/**
 * Article data for insertion (omits auto-generated fields)
 * 
 * Use this type when inserting new articles into the database.
 * The `created_at` and `image_url` fields are optional.
 */
export type ArticleInsert = Omit<ArticleRow, 'created_at' | 'image_url'> & {
  image_url?: string | null;
};

/**
 * Frontend-friendly article type
 * 
 * Same as ArticleRow for now; can be extended later if
 * frontend needs differ from database representation.
 */
export type Article = ArticleRow;

/**
 * Raw RSS feed item before processing
 * 
 * This represents the structure returned by rss-parser
 * before we transform it into our Article format.
 */
export interface RawFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
}

/**
 * Article type - distinguishes between policy news and finance news
 */
export type ArticleType = 'policy' | 'finance';

/**
 * RSS feed source configuration
 */
export interface FeedSource {
  name: string;          // Display name (e.g., 'FERC')
  url: string;           // RSS feed URL
  enabled: boolean;      // Whether to include in ingestion
  articleType?: ArticleType; // Type of articles from this feed (default: 'policy')
}

