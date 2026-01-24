import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cache duration: 6 hours (matches CRON schedule)
const CACHE_DURATION_HOURS = 6;

interface MarketSummary {
  id: number;
  headline: string;
  summary: string;
}

interface CachedSummaries {
  summaries: MarketSummary[];
  generated_at: string;
}

/**
 * GET /api/finance/market-summary
 * 
 * Returns AI-generated market summaries based on recent finance articles.
 * Summaries are cached and regenerated every 6 hours with the CRON job.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = (searchParams.get('market') || 'US').toUpperCase();
    const cacheKey = market === 'MZ' ? 'energy-finance-mz' : market === 'QA' ? 'energy-finance-qa' : 'energy-finance-us';

    const supabase = getSupabase();

    // Check for cached summaries first
    const { data: cached, error: cacheError } = await supabase
      .from('market_summaries')
      .select('*')
      .eq('id', cacheKey)
      .single();

    if (!cacheError && cached) {
      const generatedAt = new Date(cached.generated_at);
      const now = new Date();
      const hoursSinceGeneration = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);

      // Return cached if still valid
      if (hoursSinceGeneration < CACHE_DURATION_HOURS) {
        return NextResponse.json({
          summaries: cached.summaries,
          generatedAt: cached.generated_at,
          cached: true,
        });
      }
    }

    // Generate new summaries
    const summaries = await generateMarketSummaries(supabase, market);

    if (summaries.length > 0) {
      // Cache the new summaries
      const now = new Date().toISOString();
      await supabase
        .from('market_summaries')
        .upsert({
          id: cacheKey,
          summaries: summaries,
          generated_at: now,
        }, { onConflict: 'id' });

      return NextResponse.json({
        summaries,
        generatedAt: now,
        cached: false,
      });
    }

    // Fallback to static summaries if generation fails
    return NextResponse.json({
      summaries: getFallbackSummaries(),
      generatedAt: null,
      cached: false,
      fallback: true,
    });

  } catch (error) {
    console.error('[market-summary] Error:', error);
    return NextResponse.json({
      summaries: getFallbackSummaries(),
      error: 'Failed to generate summaries',
      fallback: true,
    });
  }
}

/**
 * Generate market summaries from recent finance articles using AI
 */
async function generateMarketSummaries(
  supabase: ReturnType<typeof getSupabase>,
  market: string
): Promise<MarketSummary[]> {
  // Fetch recent finance articles (last 48 hours)
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - 48);

  let query = supabase
    .from('articles')
    .select('title, summary, source, pub_date')
    .eq('article_type', 'finance')
    .gte('pub_date', cutoffDate.toISOString())
    .order('pub_date', { ascending: false })
    .limit(40);

  if (market === 'MZ') {
    query = query.or('source.ilike.%mozambique%,title.ilike.%mozambique%,summary.ilike.%mozambique%');
  } else if (market === 'QA') {
    query = query.or('source.ilike.%qatar%,title.ilike.%qatar%,summary.ilike.%qatar%');
  } else {
    query = query.in('source', ['Yahoo Finance', 'CNBC Energy']);
  }

  const { data: articles, error } = await query;

  if (error || !articles || articles.length === 0) {
    console.error('[market-summary] No recent articles found:', error);
    return [];
  }

  // Check if OpenAI is configured
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[market-summary] OpenAI API key not configured');
    return [];
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Prepare article context for AI
  const articleContext = articles
    .map((a, i) => `${i + 1}. "${a.title}" (${a.source})\n   ${a.summary}`)
    .join('\n\n');

  const systemPrompt = `You are a senior energy markets analyst creating a daily market briefing. 
Generate exactly 6 market summary items based on the provided recent news articles.

Each summary should:
- Have a short, impactful headline (max 60 characters)
- Include a 2-sentence summary focusing on market implications
- Cover different aspects: oil/gas prices, renewables, policy, commodities, stocks, infrastructure

Format your response as valid JSON array:
[
  {"headline": "...", "summary": "..."},
  ...
]

Only output the JSON array, no other text.`;

  const userPrompt = `Based on these recent energy finance articles, create 6 market summary items:

${articleContext}

Generate diverse summaries covering: oil prices, natural gas, renewable energy, energy stocks, policy impacts, and market trends.`;

  try {
    console.log('[market-summary] Generating summaries with AI...');
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error('[market-summary] Empty AI response');
      return [];
    }

    // Parse JSON response
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      console.error('[market-summary] Invalid AI response format');
      return [];
    }

    // Add IDs and validate structure
    const summaries: MarketSummary[] = parsed
      .slice(0, 6)
      .map((item: { headline?: string; summary?: string }, index: number) => ({
        id: index + 1,
        headline: item.headline || 'Market Update',
        summary: item.summary || 'No summary available.',
      }));

    console.log(`[market-summary] Generated ${summaries.length} summaries`);
    return summaries;

  } catch (aiError) {
    console.error('[market-summary] AI generation error:', aiError);
    return [];
  }
}

/**
 * Fallback summaries when AI generation fails
 */
function getFallbackSummaries(): MarketSummary[] {
  return [
    {
      id: 1,
      headline: 'Energy Markets Update',
      summary: 'Markets are showing mixed signals as investors weigh global supply dynamics against demand forecasts. Check back later for AI-generated insights.',
    },
    {
      id: 2,
      headline: 'Oil & Gas Sector',
      summary: 'Crude oil and natural gas markets continue to respond to geopolitical developments and seasonal demand patterns.',
    },
    {
      id: 3,
      headline: 'Renewable Energy Trends',
      summary: 'Clean energy investments remain strong as policy support drives growth in solar, wind, and storage sectors.',
    },
    {
      id: 4,
      headline: 'Energy Policy Watch',
      summary: 'Regulatory developments at federal and state levels continue to shape the energy landscape and compliance requirements.',
    },
    {
      id: 5,
      headline: 'Infrastructure & Grid',
      summary: 'Grid modernization and infrastructure investments are accelerating to meet growing electricity demand.',
    },
    {
      id: 6,
      headline: 'Market Outlook',
      summary: 'Analysts are monitoring key indicators including inventory levels, production data, and economic signals for near-term direction.',
    },
  ];
}

