import { Suspense } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import Image from 'next/image';
import Link from 'next/link';
import { getArticles, TimeRange } from '@/lib/getArticles';
import { ArticleCard, LargeArticleCard } from '@/components/ArticleCard';
import { CategoryChips } from '@/components/CategoryChips';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { PageWrapper } from '@/components/PageWrapper';
import { EnervaBrand } from '@/components/EnervaBrand';
import { ArticleCategory, ArticleRow } from '@/types/article';

// Force dynamic rendering - always fetch fresh data from Supabase
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

interface PageProps {
  searchParams: { category?: string; archive?: string };
}

/**
 * Groups articles into the repeating pattern:
 * - Row 1: 1 large article (image right)
 * - Row 2: 3 medium articles
 * - Row 3: 1 large article (image left)
 * 
 * Each "pattern group" consumes 5 articles total.
 */
function groupArticlesIntoPattern(articles: ArticleRow[]) {
  const groups: Array<{
    type: 'large-right' | 'medium-row' | 'large-left';
    articles: ArticleRow[];
  }> = [];

  let index = 0;
  let patternStep = 0; // 0 = large-right, 1 = medium-row, 2 = large-left

  while (index < articles.length) {
    if (patternStep === 0) {
      // Large article - image on right
      groups.push({
        type: 'large-right',
        articles: [articles[index]],
      });
      index += 1;
      patternStep = 1;
    } else if (patternStep === 1) {
      // 3 medium articles
      const mediumArticles = articles.slice(index, index + 3);
      if (mediumArticles.length > 0) {
        groups.push({
          type: 'medium-row',
          articles: mediumArticles,
        });
        index += mediumArticles.length;
      }
      patternStep = 2;
    } else if (patternStep === 2) {
      // Large article - image on left
      groups.push({
        type: 'large-left',
        articles: [articles[index]],
      });
      index += 1;
      patternStep = 0; // Reset pattern
    }
  }

  return groups;
}

/**
 * Discover Page
 * 
 * Main feed page showing energy policy articles from various sources.
 * 
 * Layout Pattern (repeating):
 * - Row 1: Large featured article (summary left, image right)
 * - Row 2: 3 medium articles (image top, text below)
 * - Row 3: Large featured article (image left, summary right)
 */
export default async function DiscoverPage({ searchParams }: PageProps) {
  noStore();

  const category = searchParams.category as ArticleCategory | undefined;
  const archive = searchParams.archive as TimeRange | undefined;
  
  const { articles, error } = await getArticles({ 
    category: category || undefined,
    timeRange: archive || 'latest',
    limit: 25 
  });

  const articleGroups = groupArticlesIntoPattern(articles);
  const isArchiveView = !!archive;

  return (
    <PageWrapper>
      <div className="min-h-screen bg-zinc-950">
        {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-center h-24">
            {/* Centered Title */}
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <EnervaBrand size="header" glow />
            </Link>
            {/* Hamburger Menu - Absolute positioned to the right */}
            <div className="absolute right-0">
              <HamburgerMenu />
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

        {/* Page Title */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-zinc-100">
            Discover
          </h2>
        </div>

        {/* Category Filters */}
        <section className="mb-10 flex justify-center">
          <Suspense fallback={<div className="h-10 bg-zinc-800/50 rounded-full animate-pulse w-96" />}>
            <CategoryChips />
          </Suspense>
        </section>

        {/* Article Layout - Repeating Pattern */}
        {articleGroups.length > 0 ? (
          <section className="space-y-8">
            {articleGroups.map((group, groupIndex) => {
              if (group.type === 'large-right') {
                return (
                  <div key={`large-right-${groupIndex}`}>
                    <LargeArticleCard 
                      article={group.articles[0]} 
                      imagePosition="right"
                      priority={groupIndex === 0}
                    />
                  </div>
                );
              }
              
              if (group.type === 'medium-row') {
                return (
                  <div 
                    key={`medium-${groupIndex}`} 
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {group.articles.map((article, idx) => (
                      <ArticleCard 
                        key={article.id} 
                        article={article} 
                        priority={groupIndex < 2 && idx < 3}
                      />
                    ))}
                  </div>
                );
              }
              
              if (group.type === 'large-left') {
                return (
                  <div key={`large-left-${groupIndex}`}>
                    <LargeArticleCard 
                      article={group.articles[0]} 
                      imagePosition="left"
                    />
                  </div>
                );
              }
              
              return null;
            })}
          </section>
        ) : (
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
        )}

        {/* Footer Stats */}
        <footer className="mt-16 pt-8 border-t border-zinc-800/50 text-center text-sm text-zinc-500">
          <p>
            Showing {articles.length} article{articles.length !== 1 ? 's' : ''}
            {category ? ` in ${category}` : ''}
            {isArchiveView ? ` from archive` : ''}
          </p>
        </footer>
      </main>
      </div>
    </PageWrapper>
  );
}
