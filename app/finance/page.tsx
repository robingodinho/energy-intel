'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { EnervaBrand } from '@/components/EnervaBrand';

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

interface MarketSummary {
  id: number;
  headline: string;
  summary: string;
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

// Fallback market summaries while loading
const FALLBACK_MARKET_SUMMARIES: MarketSummary[] = [
  { id: 1, headline: 'Loading market data...', summary: 'AI-generated market summaries are being prepared.' },
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
  const [expandedSummaries, setExpandedSummaries] = useState<Set<number>>(new Set());
  
  // Data states
  const [stocks, setStocks] = useState<Stock[]>(FALLBACK_STOCKS);
  const [forexRates, setForexRates] = useState<ForexRate[]>(FALLBACK_FOREX);
  const [articles, setArticles] = useState<FinanceArticle[]>([]);
  const [archivedArticles, setArchivedArticles] = useState<FinanceArticle[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [marketSummaries, setMarketSummaries] = useState<MarketSummary[]>(FALLBACK_MARKET_SUMMARIES);
  const [stockHistory, setStockHistory] = useState<Record<string, PricePoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [usdAmountStr, setUsdAmountStr] = useState<string>('1');
  const usdAmount = parseFloat(usdAmountStr) || 0;

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      try {
        // Fetch all data in parallel (including archived articles and market summaries)
        const [stocksRes, forexRes, articlesRes, archivedRes, historyRes, summariesRes] = await Promise.all([
          fetch('/api/finance/stocks').then(r => r.json()).catch(() => ({ stocks: FALLBACK_STOCKS })),
          fetch('/api/finance/forex').then(r => r.json()).catch(() => ({ rates: FALLBACK_FOREX })),
          fetch('/api/finance/articles?limit=6').then(r => r.json()).catch(() => ({ articles: [] })),
          fetch('/api/finance/articles?archived=true&limit=9').then(r => r.json()).catch(() => ({ articles: [] })),
          fetch('/api/finance/stock-history').then(r => r.json()).catch(() => ({ history: {} })),
          fetch('/api/finance/market-summary').then(r => r.json()).catch(() => ({ summaries: [] })),
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

        if (archivedRes.articles?.length > 0) {
          setArchivedArticles(archivedRes.articles);
        }
        
        if (historyRes.history) {
          setStockHistory(historyRes.history);
        }

        if (summariesRes.summaries?.length > 0) {
          setMarketSummaries(summariesRes.summaries);
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
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/60 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-center h-16">
            {/* Logo - Absolute positioned to the left */}
            <Link href="/" className="absolute left-0 hover:opacity-80 transition-opacity">
              <Image 
                src="/brand/android-chrome-192x192.png" 
                alt="enerva" 
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg"
              />
            </Link>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Title */}
        <h2 className="text-2xl font-semibold text-zinc-100 text-center mb-4">
          Finance
        </h2>
        
        {/* Market Selector Row */}
        <div className="mb-6">
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
        </div>

        {/* Main Grid */}
        <div className="flex gap-6">
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

            {/* Mobile Forex Rates - Shows between stocks and market summary on mobile */}
            <section className="mb-6 lg:hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">USD Exchange</h3>
                <span className="text-xs text-cyan-400">Live</span>
              </div>
              
              {/* USD Amount Input */}
              <div className="mb-4">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={usdAmountStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow empty, numbers, and decimal point
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setUsdAmountStr(val);
                      }
                    }}
                    className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-xl py-3 pl-8 pr-16 
                             text-zinc-300 text-lg font-medium placeholder-zinc-500
                             focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25
                             transition-all duration-200"
                    placeholder="1.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">USD</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {forexRates.map((forex) => {
                  const convertedValue = usdAmount * (forex.rate || 0);
                  return (
                    <div 
                      key={forex.pair}
                      className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl px-4 py-3 
                               hover:bg-zinc-800/50 hover:border-zinc-600/50 transition-colors duration-200"
                    >
                      <div className="text-center">
                        <span className="text-zinc-400 text-xs">{forex.pair}</span>
                        <div className="text-zinc-100 font-medium text-base mt-1">
                          {convertedValue.toFixed(convertedValue >= 100 ? 2 : 4)}
                        </div>
                        <div className={`text-xs ${forex.change >= 0 ? 'text-cyan-400' : 'text-red-500'}`}>
                          {forex.change >= 0 ? '+' : ''}{forex.change?.toFixed(2) || '0.00'}%
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                {marketSummaries.map((item, index) => (
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
                <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
                <span>AI-generated from recent articles</span>
              </div>
            </section>

            {/* Recent Developments Section - Articles with Images */}
            <section className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                    {showArchive ? 'Archive' : 'Recent Developments'}
                  </h2>
                  {/* Filter Toggle */}
                  <div className="flex bg-zinc-800/50 rounded-lg p-0.5">
                    <button
                      onClick={() => setShowArchive(false)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                        !showArchive 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Recent
                    </button>
                    <button
                      onClick={() => setShowArchive(true)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                        showArchive 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Archive
                    </button>
                  </div>
                </div>
                <span className="text-xs text-cyan-400">
                  {showArchive 
                    ? (archivedArticles.length > 0 ? `${archivedArticles.length} archived` : 'No archived articles')
                    : (articles.length > 0 ? `${articles.length} articles` : 'Loading...')
                  }
                </span>
              </div>
              
              {/* Articles Grid with Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(showArchive ? archivedArticles : articles).length > 0 ? (
                  (showArchive ? archivedArticles : articles).map((article) => (
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
                ) : loading ? (
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
                ) : (
                  // Empty state
                  <div className="col-span-full text-center py-12">
                    <svg className="w-16 h-16 text-zinc-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <p className="text-zinc-500 text-sm">
                      {showArchive 
                        ? 'No archived articles yet. Articles older than the 6 most recent will appear here.'
                        : 'No articles available at the moment.'}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Sidebar - Forex Rates (Desktop only) */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28">
              <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-700/40">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-100">USD Exchange</h3>
                    <span className="text-xs text-cyan-400">Live</span>
                  </div>
                </div>
                
                {/* USD Amount Input */}
                <div className="px-4 py-3 border-b border-zinc-700/40">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={usdAmountStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow empty, numbers, and decimal point
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setUsdAmountStr(val);
                        }
                      }}
                      className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-lg py-2 pl-7 pr-12 
                               text-zinc-300 text-sm font-medium placeholder-zinc-500
                               focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25
                               transition-all duration-200"
                      placeholder="1.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">USD</span>
                  </div>
                </div>
                
                <div className="divide-y divide-zinc-700/40">
                  {forexRates.map((forex) => {
                    const convertedValue = usdAmount * (forex.rate || 0);
                    return (
                      <div 
                        key={forex.pair}
                        className="px-4 py-3 hover:bg-zinc-800/30 transition-colors duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-sm">USD/{forex.pair}</span>
                          <div className="text-right">
                            <div className="text-zinc-100 font-medium text-sm">
                              {convertedValue.toFixed(convertedValue >= 100 ? 2 : 4)}
                            </div>
                            <div className={`text-xs ${forex.change >= 0 ? 'text-cyan-400' : 'text-red-500'}`}>
                              {forex.change >= 0 ? '+' : ''}{forex.change?.toFixed(2) || '0.00'}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
            © 2026 enerva. AI-Driven Intelligence for Energy Policy and Infrastructure.
          </p>
        </div>
      </footer>
    </div>
  );
}
