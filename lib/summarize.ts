/**
 * AI Summarization Module
 * 
 * Uses OpenAI to generate concise summaries of energy policy articles.
 * Summaries are 2-3 sentences focused on compliance and energy security implications.
 * 
 * IMPORTANT: This module is ONLY called during ingestion, never at page load.
 */

import OpenAI from 'openai';

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Lazy-initialized OpenAI client
 */
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Get the model to use for summarization
 * Defaults to gpt-4o-mini for cost efficiency
 */
function getModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

/**
 * System prompt for energy policy summarization
 */
const SYSTEM_PROMPT = `You are an expert energy policy analyst. Your task is to summarize news articles about U.S. energy policy for busy professionals in the energy sector.

Guidelines:
- Write exactly 2-3 concise sentences
- Focus on key policy changes, regulatory impacts, or market implications
- Highlight compliance requirements or deadlines when mentioned
- Note any implications for energy security or grid reliability
- Use professional, objective language
- Do NOT include phrases like "This article discusses" or "The summary is"
- Start directly with the key information

Your audience includes:
- Energy company executives
- Regulatory compliance officers
- Policy analysts
- Grid operators`;

/**
 * Result of a summarization attempt
 */
export interface SummarizeResult {
  success: boolean;
  summary?: string;
  error?: string;
  tokensUsed?: number;
}

/**
 * Summarize a single article using OpenAI
 * 
 * @param title - Article title
 * @param content - Article content or snippet (optional)
 * @param source - Source name for context
 * @returns SummarizeResult with summary or error
 */
export async function summarizeArticle(
  title: string,
  content?: string,
  source?: string
): Promise<SummarizeResult> {
  try {
    const openai = getOpenAI();
    const model = getModel();

    // Build the user prompt
    const contentPart = content ? `\n\nContent:\n${content.slice(0, 2000)}` : '';
    const sourcePart = source ? ` (from ${source})` : '';
    
    const userPrompt = `Summarize this energy news article${sourcePart}:

Title: ${title}${contentPart}

Provide a 2-3 sentence summary focusing on policy implications, compliance requirements, or market impacts.`;

    if (isDev) {
      console.log(`[summarize] Calling ${model} for: ${title.slice(0, 50)}...`);
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.3, // Lower temperature for more consistent outputs
    });

    const summary = response.choices[0]?.message?.content?.trim();
    const tokensUsed = response.usage?.total_tokens || 0;

    if (!summary) {
      return { success: false, error: 'Empty response from OpenAI' };
    }

    if (isDev) {
      console.log(`[summarize] ✅ Generated ${summary.length} chars, ${tokensUsed} tokens`);
    }

    return {
      success: true,
      summary,
      tokensUsed,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[summarize] ❌ Error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Batch summarize multiple articles
 * 
 * Processes articles sequentially to respect rate limits.
 * Includes a small delay between requests.
 * 
 * @param articles - Array of articles to summarize
 * @param delayMs - Delay between requests (default 200ms)
 * @returns Map of article id -> summary (or null if failed)
 */
export async function summarizeArticles(
  articles: { id: string; title: string; content?: string; source?: string }[],
  delayMs: number = 200
): Promise<{
  results: Map<string, string | null>;
  totalTokens: number;
  successCount: number;
  failCount: number;
}> {
  const results = new Map<string, string | null>();
  let totalTokens = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    
    const result = await summarizeArticle(
      article.title,
      article.content,
      article.source
    );

    if (result.success && result.summary) {
      results.set(article.id, result.summary);
      totalTokens += result.tokensUsed || 0;
      successCount++;
    } else {
      results.set(article.id, null);
      failCount++;
    }

    // Small delay between requests to respect rate limits
    if (i < articles.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { results, totalTokens, successCount, failCount };
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Get a fallback summary when AI is unavailable
 */
export function getFallbackSummary(title: string): string {
  // Use the title as a basic summary, truncated if needed
  const maxLength = 200;
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength - 3) + '...';
}

