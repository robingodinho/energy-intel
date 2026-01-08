import Link from 'next/link';
import Image from 'next/image';
import { HamburgerMenu } from '@/components/HamburgerMenu';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Header - Matching main feed page */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-center h-20">
            {/* Logo - Absolute positioned to the left */}
            <Link href="/" className="absolute left-0">
              <Image 
                src="/logo/logo.png" 
                alt="Energy Intel Logo" 
                width={64}
                height={64}
                className="h-16 w-auto hover:opacity-80 transition-opacity"
              />
            </Link>
            {/* Centered Title */}
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <h1 className="text-3xl font-semibold text-zinc-100 font-sora tracking-tight">
                Energy Intel
              </h1>
            </Link>
            {/* Hamburger Menu - Absolute positioned to the right */}
            <div className="absolute right-0">
              <HamburgerMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Title Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
              About Energy Intel
            </h1>
            <p className="text-xl text-zinc-400 font-light">
              AI-Driven Intelligence for Energy Policy and Infrastructure
            </p>
          </div>

          {/* About Content */}
          <div className="prose prose-invert max-w-none space-y-6">
            <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-2xl font-semibold text-cyan-400 mb-4">Our Mission</h2>
              <p className="text-zinc-300 leading-relaxed">
                Energy Intel is a cutting-edge intelligence platform that aggregates and analyzes U.S. federal energy policy updates 
                in real-time. We help energy professionals, policy analysts, and industry leaders stay informed about critical 
                regulatory changes, market developments, and infrastructure initiatives that shape the American energy landscape.
              </p>
            </section>

            <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-2xl font-semibold text-cyan-400 mb-4">How It Works</h2>
              <div className="space-y-4 text-zinc-300">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100 mb-1">Automated Aggregation</h3>
                    <p className="leading-relaxed">
                      We continuously monitor official RSS feeds from key agencies including the Department of Energy (DOE), 
                      Energy Information Administration (EIA), and leading energy publications.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100 mb-1">AI-Powered Analysis</h3>
                    <p className="leading-relaxed">
                      Our advanced AI system (powered by OpenAI) generates concise, professional summaries that highlight 
                      compliance requirements, policy implications, and market impacts—saving you hours of reading.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100 mb-1">Smart Categorization</h3>
                    <p className="leading-relaxed">
                      Articles are automatically categorized into key sectors: LNG, Renewable Energy, Energy Policy, 
                      Emissions, and Infrastructure, making it easy to find relevant updates in your area of focus.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100 mb-1">Real-Time Updates</h3>
                    <p className="leading-relaxed">
                      Our platform updates every 6 hours, ensuring you never miss critical policy changes or regulatory 
                      announcements that could impact your operations.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-2xl font-semibold text-cyan-400 mb-4">Key Features</h2>
              <ul className="space-y-3 text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 mt-1">✓</span>
                  <span><strong className="text-zinc-100">Professional Summaries:</strong> 2-3 sentence AI-generated summaries focused on compliance and business impact</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 mt-1">✓</span>
                  <span><strong className="text-zinc-100">Visual Context:</strong> Automatic cover image extraction for better content preview</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 mt-1">✓</span>
                  <span><strong className="text-zinc-100">Category Filters:</strong> Quickly filter by your areas of interest</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 mt-1">✓</span>
                  <span><strong className="text-zinc-100">Direct Sources:</strong> One-click access to original articles and official announcements</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 mt-1">✓</span>
                  <span><strong className="text-zinc-100">Mobile Responsive:</strong> Stay informed on any device</span>
                </li>
              </ul>
            </section>

            {/* Finance Dashboard Section */}
            <section className="bg-gradient-to-br from-zinc-900/50 to-cyan-950/20 rounded-xl p-6 border border-cyan-800/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3v18h18M9 17V9m4 8v-5m4 5v-8" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-cyan-400">Finance Dashboard</h2>
              </div>
              <p className="text-zinc-300 leading-relaxed mb-6">
                Our dedicated Finance page provides real-time market intelligence for energy sector investors and analysts, 
                combining live market data with AI-powered insights.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-800/40 rounded-lg p-4 border border-zinc-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <h3 className="font-semibold text-zinc-100">Live Stock Prices</h3>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Real-time quotes for major energy stocks (XOM, CVX, COP, EOG, SLB, OXY) powered by the 
                    <span className="text-cyan-400"> Alpha Vantage API</span>. Includes price changes, percentage movements, 
                    and interactive mini-charts showing intraday trends.
                  </p>
                </div>

                <div className="bg-zinc-800/40 rounded-lg p-4 border border-zinc-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="font-semibold text-zinc-100">Foreign Exchange Rates</h3>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Live USD exchange rates for 8 major currencies (EUR, GBP, JPY, CAD, CNY, INR, CHF, AUD) via the 
                    <span className="text-cyan-400"> Exchange Rate API</span>. Features an interactive currency converter 
                    for quick calculations.
                  </p>
                </div>

                <div className="bg-zinc-800/40 rounded-lg p-4 border border-zinc-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                    <h3 className="font-semibold text-zinc-100">AI Market Summaries</h3>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Six AI-generated market insights updated every 6 hours, powered by 
                    <span className="text-cyan-400"> OpenAI GPT-4o-mini</span>. The AI analyzes recent finance articles 
                    to produce actionable summaries covering oil, gas, renewables, and market trends.
                  </p>
                </div>

                <div className="bg-zinc-800/40 rounded-lg p-4 border border-zinc-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <h3 className="font-semibold text-zinc-100">Finance News Feed</h3>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Curated energy finance articles from <span className="text-cyan-400">Yahoo Finance</span> and 
                    <span className="text-cyan-400"> CNBC Energy</span>. Features smart archiving—always 6 recent articles 
                    with older content accessible in the Archive tab.
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-2xl font-semibold text-cyan-400 mb-4">Technology Stack</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-zinc-300">
                <div>
                  <h3 className="font-semibold text-zinc-100 mb-2">Frontend</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Next.js 14 (App Router)</li>
                    <li>• React 18</li>
                    <li>• Tailwind CSS</li>
                    <li>• TypeScript</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 mb-2">Backend & Database</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Supabase (PostgreSQL)</li>
                    <li>• Vercel (Hosting & Cron)</li>
                    <li>• RSS Feed Parsing</li>
                    <li>• Server-side Caching</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 mb-2">AI & APIs</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• OpenAI GPT-4o-mini</li>
                    <li>• Alpha Vantage (Stocks)</li>
                    <li>• Exchange Rate API (Forex)</li>
                    <li>• Image Scraping (OG Tags)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-2xl font-semibold text-cyan-400 mb-4">Data Sources</h2>
              <p className="text-zinc-300 mb-4">
                We aggregate content from trusted sources in the energy sector:
              </p>
              
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Policy & News Sources</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-6">
                <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-zinc-300">
                  Department of Energy (DOE)
                </div>
                <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-zinc-300">
                  Energy Information Administration (EIA)
                </div>
                <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-zinc-300">
                  Power Magazine
                </div>
                <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-zinc-300">
                  Utility Dive
                </div>
                <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-zinc-300">
                  Renewable Energy World
                </div>
                <div className="px-3 py-2 bg-zinc-800/50 rounded-lg text-zinc-300">
                  Energy Storage News
                </div>
              </div>

              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Finance & Market Data</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="px-3 py-2 bg-cyan-900/30 rounded-lg text-cyan-300 border border-cyan-800/30">
                  Yahoo Finance
                </div>
                <div className="px-3 py-2 bg-cyan-900/30 rounded-lg text-cyan-300 border border-cyan-800/30">
                  CNBC Energy
                </div>
                <div className="px-3 py-2 bg-cyan-900/30 rounded-lg text-cyan-300 border border-cyan-800/30">
                  Alpha Vantage API
                </div>
                <div className="px-3 py-2 bg-cyan-900/30 rounded-lg text-cyan-300 border border-cyan-800/30">
                  Exchange Rate API
                </div>
                <div className="px-3 py-2 bg-cyan-900/30 rounded-lg text-cyan-300 border border-cyan-800/30">
                  OpenAI GPT-4o-mini
                </div>
              </div>
            </section>

            <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-2xl font-semibold text-cyan-400 mb-4 text-center">Contributor</h2>
              
              {/* Profile Image */}
              <div className="flex justify-center mb-6">
                <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-cyan-500/20">
                  <Image 
                    src="/about-images/Robin.jpg" 
                    alt="Robin Godinho"
                    fill
                    className="object-cover scale-125"
                  />
                </div>
              </div>
              
              {/* Bio */}
              <div className="max-w-3xl mx-auto space-y-4 text-center">
                <p className="text-zinc-300 leading-relaxed">
                  Robin Godinho is an information management professional with experience designing AI-enabled data pipelines 
                  and decision-support systems. His work focuses on applying artificial intelligence to complex, high-impact 
                  domains such as energy policy, infrastructure planning, and regulatory analysis.
                </p>
                <p className="text-zinc-300 leading-relaxed">
                  Energy Intel reflects this focus by combining real-time data aggregation with AI-driven intelligence 
                  to support informed decision-making in the energy sector.
                </p>
              </div>
            </section>
          </div>
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
