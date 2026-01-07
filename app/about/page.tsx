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

            <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-2xl font-semibold text-cyan-400 mb-4">Technology Stack</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-zinc-300">
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
                  <h3 className="font-semibold text-zinc-100 mb-2">Backend</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Supabase (PostgreSQL)</li>
                    <li>• OpenAI GPT-4o-mini</li>
                    <li>• Vercel (Hosting & Cron)</li>
                    <li>• RSS Feed Parsing</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-2xl font-semibold text-cyan-400 mb-4">Data Sources</h2>
              <p className="text-zinc-300 mb-4">
                We aggregate content from trusted sources in the energy sector:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
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
