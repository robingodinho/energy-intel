'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArticleCategory } from '@/types/article';

const CATEGORIES: (ArticleCategory | 'All')[] = [
  'All',
  'LNG',
  'Renewable Energy',
  'Energy Policy',
  'Emissions',
  'Infrastructure',
];

/**
 * Category Filter Chips
 * 
 * Client component for filtering articles by category.
 * Uses URL query params for shareable links.
 */
export function CategoryChips() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category') || 'All';

  const handleCategoryClick = (category: ArticleCategory | 'All') => {
    if (category === 'All') {
      router.push('/');
    } else {
      router.push(`/?category=${encodeURIComponent(category)}`);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((category) => {
        const isActive = currentCategory === category || 
                        (category === 'All' && !searchParams.get('category'));
        
        return (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            className={`
              px-4 py-2 text-sm font-medium rounded-full transition-all duration-200
              ${isActive 
                ? 'bg-cyan-500 text-zinc-900 shadow-lg shadow-cyan-500/25' 
                : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/50'
              }
            `}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}

