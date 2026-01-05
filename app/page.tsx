import { Suspense } from 'react';
import { getArticles } from '@/lib/getArticles';
import { ArticleCard, HeroArticleCard } from '@/components/ArticleCard';
import { CategoryChips } from '@/components/CategoryChips';
import { ArticleCategory } from '@/types/article';

// Force dynamic rendering - always fetch fresh data from Supabase
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { category?: string };
}

/**
 * Discover Page
 * 
 * Main feed page showing energy policy articles from various sources.
 * Features:
 * - Hero section with most recent article
 * - Category filter chips
 * - Responsive grid of article cards
 */
export default async function DiscoverPage({ searchParams }: PageProps) {
  const category = searchParams.category as ArticleCategory | undefined;
  
  // Fetch articles from Supabase
  const { articles, error } = await getArticles({ 
    category: category || undefined,
    limit: 50 
  });

  // Get hero article (first/most recent)
  const heroArticle = articles[0];
  // Get remaining articles for the grid
  const gridArticles = articles.slice(1);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-zinc-100">Energy Intel</h1>
            <div className="flex items-center gap-4">
              <a 
                href="/about" 
                className="px-4 py-2 text-sm font-medium text-zinc-400 bg-zinc-800/50 rounded-lg 
                         hover:bg-zinc-700 hover:text-zinc-100 transition-all duration-200"
              >
                About
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <p>Error loading articles: {error}</p>
          </div>
        )}

        {/* Slogan */}
        <div className="text-center mb-6">
          <p className="text-lg sm:text-xl text-zinc-400 font-light tracking-wide">
            AI-Driven Intelligence for Energy Policy and Infrastructure.
          </p>
        </div>

        {/* Category Filters */}
        <section className="mb-8 flex justify-center">
          <Suspense fallback={<div className="h-10 bg-zinc-800/50 rounded-full animate-pulse w-96" />}>
            <CategoryChips />
          </Suspense>
        </section>

        {/* Hero Article */}
        {heroArticle && (
          <section className="mb-12">
            <HeroArticleCard article={heroArticle} />
          </section>
        )}

        {/* Articles Grid */}
        {gridArticles.length > 0 ? (
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {gridArticles.map((article, index) => (
                <ArticleCard 
                  key={article.id} 
                  article={article} 
                  priority={index < 4} // Prioritize first 4 images
                />
              ))}
            </div>
          </section>
        ) : !heroArticle ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-800 mb-4">
              <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-300 mb-2">No articles found</h3>
            <p className="text-zinc-500">
              {category 
                ? `No articles in the "${category}" category yet.` 
                : 'Run the ingestion to populate articles.'}
            </p>
          </div>
        ) : null}

        {/* Footer Stats */}
        <footer className="mt-16 pt-8 border-t border-zinc-800/50 text-center text-sm text-zinc-500">
          <p>
            Showing {articles.length} article{articles.length !== 1 ? 's' : ''}
            {category ? ` in ${category}` : ''}
          </p>
        </footer>
      </main>
    </div>
  );
}
