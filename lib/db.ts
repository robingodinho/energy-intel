import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ArticleRow, ArticleInsert } from '@/types/article';

// Re-export types for convenience
export type { ArticleRow, ArticleInsert } from '@/types/article';

/**
 * Supabase client singleton
 * 
 * Uses environment variables:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_ANON_KEY: Your Supabase anon/public key
 * 
 * Server-side only - do not expose to client components
 */
function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Server-side: no session persistence needed
    },
  });
}

// Lazy initialization to avoid errors during build time
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient();
  }
  return supabaseInstance;
}

/**
 * Insert articles into the database
 * 
 * Uses upsert to handle duplicates gracefully (based on id primary key)
 * 
 * @param articles - Array of articles to insert
 * @returns Object with inserted count and any errors
 */
export async function insertArticles(
  articles: ArticleInsert[]
): Promise<{ inserted: number; errors: string[] }> {
  if (articles.length === 0) {
    return { inserted: 0, errors: [] };
  }

  const supabase = getSupabase();
  const errors: string[] = [];
  let inserted = 0;

  // Use upsert to handle duplicates (articles with same id are skipped)
  const { data, error } = await supabase
    .from('articles')
    .upsert(articles, {
      onConflict: 'id',
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    errors.push(`Database error: ${error.message}`);
  } else {
    inserted = data?.length ?? 0;
  }

  return { inserted, errors };
}

/**
 * Fetch articles from the database
 * 
 * @param options - Query options
 * @returns Array of articles sorted by pub_date descending
 */
export async function fetchArticles(options?: {
  category?: string;
  limit?: number;
}): Promise<{ data: ArticleRow[]; error: string | null }> {
  const supabase = getSupabase();
  
  let query = supabase
    .from('articles')
    .select('*')
    .order('pub_date', { ascending: false });

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data as ArticleRow[], error: null };
}

/**
 * Check if an article already exists in the database
 * 
 * @param id - Article ID to check
 * @returns true if article exists, false otherwise
 */
export async function articleExists(id: string): Promise<boolean> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('articles')
    .select('id')
    .eq('id', id)
    .limit(1)
    .single();

  if (error) {
    // PGRST116 means no rows found - article doesn't exist
    if (error.code === 'PGRST116') {
      return false;
    }
    // For other errors, log and assume doesn't exist
    console.error('Error checking article existence:', error);
    return false;
  }

  return !!data;
}

/**
 * Check which article IDs already exist in the database (batch)
 * 
 * @param ids - Array of article IDs to check
 * @returns Set of IDs that already exist
 */
export async function getExistingArticleIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }

  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('articles')
    .select('id')
    .in('id', ids);

  if (error) {
    console.error('Error checking existing articles:', error);
    return new Set();
  }

  return new Set(data?.map(row => row.id) || []);
}
