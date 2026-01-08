'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { HamburgerMenu } from '@/components/HamburgerMenu';

// Types for API responses
interface Stock {
  symbol: string;
  companyName: string;
  currentPrice: number;
  change: number;
  changePercent: number;
}

interface ForexRate {
  pair: string;
  rate: number;
  change: number;
}

interface FinanceArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  link: string;
  pubDate: string;
  imageUrl: string | null;
  timeAgo: string;
  category?: string;
}

// Fallback images for sources that don't provide article-specific images
const SOURCE_FALLBACK_IMAGES: Record<string, string> = {
  'Yahoo Finance': 'https://s.yimg.com/cv/apiv2/cv/apiv2/social/images/yahoo-finance-default-logo.png',
};

// Get display image for an article (use fallback if no image)
function getArticleImage(article: FinanceArticle): string | null {
  if (article.imageUrl) return article.imageUrl;
  return SOURCE_FALLBACK_IMAGES[article.source] || null;
}

// Fallback data
const FALLBACK_STOCKS: Stock[] = [
  { symbol: 'XOM', companyName: 'Exxon Mobil', currentPrice: 105.42, change: 1.23, changePercent: 1.18 },
  { symbol: 'CVX', companyName: 'Chevron', currentPrice: 148.76, change: -0.89, changePercent: -0.60 },
  { symbol: 'COP', companyName: 'ConocoPhillips', currentPrice: 103.21, change: 2.15, changePercent: 2.13 },
  { symbol: 'EOG', companyName: 'EOG Resources', currentPrice: 128.54, change: 0.67, changePercent: 0.52 },
  { symbol: 'SLB', companyName: 'Schlumberger', currentPrice: 42.18, change: -0.34, changePercent: -0.80 },
  { symbol: 'OXY', companyName: 'Occidental', currentPrice: 47.92, change: 1.05, changePercent: 2.24 },
];

const FALLBACK_FOREX: ForexRate[] = [
  { pair: 'EUR', rate: 0.92, change: 0.12 },
  { pair: 'GBP', rate: 0.79, change: -0.08 },
  { pair: 'JPY', rate: 157.24, change: 0.45 },
  { pair: 'CAD', rate: 1.44, change: -0.15 },
  { pair: 'CNY', rate: 7.33, change: 0.22 },
  { pair: 'INR', rate: 85.72, change: 0.18 },
  { pair: 'CHF', rate: 0.90, change: -0.05 },
  { pair: 'AUD', rate: 1.61, change: 0.31 },
];

const MARKET_SUMMARIES = [
  {
    id: 1,
    headline: 'Oil Prices Surge on OPEC+ Supply Concerns',
    summary: 'Crude oil prices climbed 2.3% to $78.45 per barrel as OPEC+ signals potential production cuts. Market analysts expect continued volatility amid geopolitical tensions in the Middle East and shifting demand forecasts from major economies.',
  },
  {
    id: 2,
    headline: 'Natural Gas Rallies Amid Cold Weather Forecasts',
    summary: 'Natural gas futures jumped 4.1% as meteorologists predict below-average temperatures across the Northeast. Storage levels remain 5% below the five-year average, adding upward pressure on prices.',
  },
  {
    id: 3,
    headline: 'Renewable Energy Stocks See Strong Gains on Policy Support',
    summary: 'Solar and wind energy companies rallied following new federal incentives announcement. First Solar (FSLR) gained 5.2% while NextEra Energy (NEE) rose 3.1% on increased investor optimism.',
  },
  {
    id: 4,
    headline: 'Energy Sector Outperforms Broader Market',
    summary: 'The S&P 500 Energy sector rose 1.8% compared to 0.4% for the broader index. Integrated oil majors led gains as refining margins improved and upstream operations showed strong cash flow generation.',
  },
  {
    id: 5,
    headline: 'LNG Export Capacity Expansion Accelerates',
    summary: 'U.S. LNG exports reached record levels as new terminal capacity comes online. European demand remains robust despite mild winter, while Asian buyers secure long-term contracts.',
  },
  {
    id: 6,
    headline: 'Battery Storage Investments Hit New High',
    summary: 'Grid-scale battery storage deployments increased 45% year-over-year. Declining lithium-ion costs and supportive regulations drive utility-scale project approvals across multiple states.',
  },
];

type Market = 'US';

// Price point interface for historical data
interface PricePoint {
  timestamp: number;
  price: number;
}

// Mini line chart component - uses real price data when available
function MiniLineChart({ 
  isPositive, 
  symbol,
  priceHistory 
}: { 
  isPositive: boolean; 
  symbol: string;
  priceHistory?: PricePoint[];
}) {
  const { pathD, areaD } = useMemo(() => {
    let points: { x: number; y: number }[];
    
    if (priceHistory && priceHistory.length >= 2) {
      // Use real price data
      const prices = priceHistory.map(p => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice || 1; // Avoid division by zero
      
      // Normalize prices to fit in SVG viewBox (5-35 Y range)
      points = priceHistory.map((p, i) => ({
        x: (i / (priceHistory.length - 1)) * 88,
        y: 35 - ((p.price - minPrice) / priceRange) * 30, // Invert Y axis
      }));
    } else {
      // Fallback: generate decorative chart based on trend
      const baseY = isPositive ? 30 : 10;
      const trend = isPositive ? -1.5 : 1.5;
      points = Array.from({ length: 12 }, (_, i) => ({
        x: i * 8,
        y: Math.max(5, Math.min(35, baseY + (i * trend))),
      }));
    }
    
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} 40 L 0 40 Z`;
    
    return { pathD, areaD };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPositive, priceHistory]);
  
  // Use unique gradient IDs per instance to avoid conflicts
  const gradientId = `gradient-${symbol}-${isPositive ? 'up' : 'down'}`;
  
  return (
    <svg viewBox="0 0 88 40" className="w-full h-8" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={isPositive ? 'rgb(34, 211, 238)' : 'rgb(239, 68, 68)'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isPositive ? 'rgb(34, 211, 238)' : 'rgb(239, 68, 68)'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path 
        d={pathD} 
        fill="none" 
        stroke={isPositive ? 'rgb(34, 211, 238)' : 'rgb(239, 68, 68)'} 
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Source icon component
function SourceIcon({ source }: { source: string }) {
  const initial = source.charAt(0).toUpperCase();
  const colors: Record<string, string> = {
    'Yahoo Finance': 'bg-purple-600',
    'CNBC Energy': 'bg-blue-600',
    'Reuters': 'bg-orange-600',
    'Bloomberg': 'bg-black',
  };
  const bgColor = colors[source] || 'bg-zinc-600';
  
  return (
    <div className={`w-6 h-6 rounded-full ${bgColor} flex items-center justify-center text-white text-xs font-bold`}>
      {initial}
    </div>
  );
}

export default function FinancePage() {
  const [selectedMarket, setSelectedMarket] = useState<Market>('US');
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState<Set<number>>(new Set([1]));
  
  // Data states
  const [stocks, setStocks] = useState<Stock[]>(FALLBACK_STOCKS);
  const [forexRates, setForexRates] = useState<ForexRate[]>(FALLBACK_FOREX);
  const [articles, setArticles] = useState<FinanceArticle[]>([]);
  const [stockHistory, setStockHistory] = useState<Record<string, PricePoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      try {
        // Fetch all data in parallel
        const [stocksRes, forexRes, articlesRes, historyRes] = await Promise.all([
          fetch('/api/finance/stocks').then(r => r.json()).catch(() => ({ stocks: FALLBACK_STOCKS })),
          fetch('/api/finance/forex').then(r => r.json()).catch(() => ({ rates: FALLBACK_FOREX })),
          fetch('/api/finance/articles?limit=6').then(r => r.json()).catch(() => ({ articles: [] })),
          fetch('/api/finance/stock-history').then(r => r.json()).catch(() => ({ history: {} })),
        ]);

        if (stocksRes.stocks?.length > 0) {
          setStocks(stocksRes.stocks);
        }
        
        if (forexRes.rates?.length > 0) {
          setForexRates(forexRes.rates);
        }
        
        if (articlesRes.articles?.length > 0) {
          setArticles(articlesRes.articles);
        }
        
        if (historyRes.history) {
          setStockHistory(historyRes.history);
        }
        
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Error fetching finance data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleSummary = (id: number) => {
    setExpandedSummaries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-center h-20">
            <Link href="/" className="absolute left-0">
              <Image 
                src="/logo/logo.png" 
                alt="Energy Intel Logo" 
                width={64}
                height={64}
                className="h-16 w-auto hover:opacity-80 transition-opacity"
              />
            </Link>
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <h1 className="text-3xl font-semibold text-zinc-100 font-sora tracking-tight">
                Energy Intel
              </h1>
            </Link>
            <div className="absolute right-0">
              <HamburgerMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Market Selector Row */}
        <div className="relative flex items-center justify-between mb-6">
          <div className="relative inline-block">
            <button
              onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg
                       hover:bg-zinc-800 transition-colors duration-200"
            >
              <Image 
                src="/finance/united_states.png"
                alt="US Flag"
                width={24}
                height={16}
                className="w-6 h-4 object-cover rounded-sm"
              />
              <span className="text-zinc-100 font-medium">
                US Markets
              </span>
              <svg 
                className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${marketDropdownOpen ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {marketDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl 
                            shadow-xl shadow-black/30 overflow-hidden z-50">
                <button
                  onClick={() => { setSelectedMarket('US'); setMarketDropdownOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition-colors
                            ${selectedMarket === 'US' ? 'text-cyan-400' : 'text-zinc-300'}`}
                >
                  <Image src="/finance/united_states.png" alt="US Flag" width={24} height={16} className="w-6 h-4 object-cover rounded-sm" />
                  <span>US Markets</span>
                  {selectedMarket === 'US' && (
                    <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
          
          <h2 className="text-2xl font-semibold text-zinc-100 absolute left-1/2 -translate-x-1/2">
            Finance
          </h2>
          
          <div className="w-[140px]"></div>
        </div>

        {/* Main Grid */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Content Area */}
          <div className="flex-1 min-w-0">
            {/* Stock Prices Row */}
            <section className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  Energy Stocks
                </h2>
                <span className="text-xs text-zinc-500">
                  {loading ? 'Loading...' : `Markets ${new Date().getHours() >= 9 && new Date().getHours() < 16 ? 'Open' : 'Closed'}`}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {stocks.map((stock, index) => (
                  <div 
                    key={stock.symbol}
                    className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4 
                             hover:bg-zinc-800/50 hover:border-zinc-600/50 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-zinc-100 font-semibold">{stock.symbol}</span>
                        <p className="text-xs text-zinc-500 truncate">{stock.companyName}</p>
                      </div>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded min-w-[52px] text-right ${
                        stock.change >= 0 
                          ? 'text-cyan-400 bg-cyan-400/10' 
                          : 'text-red-500 bg-red-500/10'
                      }`}>
                        {stock.change >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2) || '0.00'}%
                      </span>
                    </div>
                    <div className="mb-2">
                      <MiniLineChart 
                        isPositive={stock.change >= 0} 
                        symbol={stock.symbol}
                        priceHistory={stockHistory[stock.symbol]}
                      />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-zinc-100">
                        ${stock.currentPrice?.toFixed(2) || '0.00'}
                      </span>
                      <span className={`text-xs ${stock.change >= 0 ? 'text-cyan-400' : 'text-red-500'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Market Summary Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  Market Summary
                </h2>
                <span className="text-xs text-cyan-400">
                  {lastUpdated ? `Updated ${lastUpdated}` : 'Updating...'}
                </span>
              </div>
              <div className="bg-zinc-800/25 border border-zinc-700/40 rounded-xl overflow-hidden">
                {MARKET_SUMMARIES.map((item, index) => (
                  <div 
                    key={item.id}
                    className={`${index !== 0 ? 'border-t border-zinc-700/40' : ''}`}
                  >
                    <button
                      onClick={() => toggleSummary(item.id)}
                      className="w-full flex items-center justify-between px-5 py-3 
                               hover:bg-zinc-800/30 transition-colors duration-200 text-left"
                    >
                      <span className="text-zinc-100 font-medium text-sm">
                        {item.headline}
                      </span>
                      <svg 
                        className={`w-5 h-5 text-zinc-500 flex-shrink-0 ml-4 transition-transform duration-200 
                                  ${expandedSummaries.has(item.id) ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSummaries.has(item.id) && (
                      <div className="px-5 pb-3">
                        <p className="text-zinc-400 text-sm leading-relaxed">
                          {item.summary}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
                <div className="flex -space-x-1">
                  <div className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-800 flex items-center justify-center text-[8px]">R</div>
                  <div className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-800 flex items-center justify-center text-[8px]">B</div>
                  <div className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-800 flex items-center justify-center text-[8px]">C</div>
                </div>
                <span>42 Sources</span>
              </div>
            </section>

            {/* Recent Developments Section - Articles with Images */}
            <section className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  Recent Developments
                </h2>
                <span className="text-xs text-cyan-400">
                  {articles.length > 0 ? `${articles.length} articles` : 'Loading...'}
                </span>
              </div>
              
              {/* Articles Grid with Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles.length > 0 ? (
                  articles.map((article) => (
                    <a
                      key={article.id}
                      href={article.link}
                      className="group bg-zinc-800/30 border border-zinc-700/40 rounded-xl overflow-hidden
                               hover:bg-zinc-800/50 hover:border-zinc-600/50 transition-all duration-200"
                    >
                      {/* Article Image */}
                      <div className="relative aspect-[16/10] bg-zinc-800 overflow-hidden">
                        {(() => {
                          const displayImage = getArticleImage(article);
                          const isLogo = displayImage && displayImage.includes('logo');
                          
                          if (displayImage) {
                            return (
                              <div className={`w-full h-full flex items-center justify-center ${
                                isLogo ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 p-6' : ''
                              }`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={displayImage} 
                                  alt={article.title}
                                  className={`${
                                    isLogo 
                                      ? 'max-h-full max-w-full object-contain' 
                                      : 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                                  }`}
                                />
                              </div>
                            );
                          }
                          
                          return (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                              <svg className="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                              </svg>
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Article Content */}
                      <div className="p-4">
                        {/* Title */}
                        <h3 className="text-zinc-100 font-medium text-sm leading-snug mb-2 
                                     group-hover:text-cyan-400 transition-colors duration-200 line-clamp-2">
                          {article.title}
                        </h3>
                        
                        {/* Summary */}
                        <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2 mb-3">
                          {article.summary}
                        </p>
                        
                        {/* Footer: Source and Time */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <SourceIcon source={article.source} />
                            <span className="text-xs text-zinc-400">{article.source}</span>
                          </div>
                          <span className="text-xs text-zinc-500">{article.timeAgo}</span>
                        </div>
                      </div>
                    </a>
                  ))
                ) : (
                  // Loading skeleton
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl overflow-hidden animate-pulse">
                      <div className="aspect-[16/10] bg-zinc-800"></div>
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                        <div className="h-3 bg-zinc-800 rounded w-full"></div>
                        <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Sidebar - Forex Rates */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-28">
              <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-700/40">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-100">USD Exchange</h3>
                    <span className="text-xs text-cyan-400">Live</span>
                  </div>
                </div>
                
                <div className="divide-y divide-zinc-700/40">
                  {forexRates.map((forex) => (
                    <div 
                      key={forex.pair}
                      className="px-4 py-3 hover:bg-zinc-800/30 transition-colors duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">USD/{forex.pair}</span>
                        <div className="text-right">
                          <div className="text-zinc-100 font-medium text-sm">
                            {forex.rate?.toFixed(forex.rate >= 100 ? 2 : 4) || '0.00'}
                          </div>
                          <div className={`text-xs ${forex.change >= 0 ? 'text-cyan-400' : 'text-red-500'}`}>
                            {forex.change >= 0 ? '+' : ''}{forex.change?.toFixed(2) || '0.00'}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 border-t border-zinc-700/40 bg-zinc-800/30">
                  <p className="text-xs text-zinc-500 text-center">
                    Rates updated every 5 minutes
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-sm text-zinc-500">
            © 2026 Energy Intel. AI-Driven Intelligence for Energy Policy and Infrastructure.
          </p>
        </div>
      </footer>
    </div>
  );
}
