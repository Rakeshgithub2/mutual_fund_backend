// Using native fetch available in Node.js 18+
import { prisma } from '../db';

interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: Array<{
    article_id: string;
    title: string;
    link: string;
    description: string;
    content: string;
    pubDate: string;
    source_id: string;
    category: string[];
    keywords?: string[];
  }>;
}

export class NewsService {
  private readonly apiKey = process.env.NEWSDATA_API_KEY || '';
  private readonly baseUrl = 'https://newsdata.io/api/1/news';

  async ingestNews(
    category: string = 'business',
    keywords: string[] = [
      'mutual fund',
      'investment',
      'portfolio',
      'equity',
      'debt',
    ]
  ): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      if (!this.apiKey) {
        throw new Error('NEWSDATA_API_KEY is not configured');
      }

      console.log(`Starting news ingestion for category: ${category}`);

      const keywordParam = keywords.join(',');
      const url = `${this.baseUrl}?apikey=${this.apiKey}&q=${encodeURIComponent(keywordParam)}&language=en&country=in&category=business`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `News API error: ${response.status} ${response.statusText}`
        );
      }

      const data: NewsDataResponse =
        (await response.json()) as NewsDataResponse;

      if (data.status !== 'success') {
        throw new Error('News API returned error status');
      }

      console.log(`Fetched ${data.results.length} news articles`);

      // Process articles in batches
      const batchSize = 10;
      for (let i = 0; i < data.results.length; i += batchSize) {
        const batch = data.results.slice(i, i + batchSize);
        try {
          await this.processBatch(batch, category);
          processed += batch.length;
          console.log(
            `Processed news batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.results.length / batchSize)}`
          );
        } catch (error) {
          const errorMsg = `News batch ${Math.floor(i / batchSize) + 1} failed: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(
        `News ingestion completed. Processed: ${processed}, Errors: ${errors.length}`
      );
      return { processed, errors };
    } catch (error) {
      console.error('News ingestion failed:', error);
      errors.push(`News ingestion failed: ${error}`);
      return { processed, errors };
    }
  }

  private async processBatch(
    articles: NewsDataResponse['results'],
    category: string
  ): Promise<void> {
    for (const article of articles) {
      try {
        await this.processArticle(article, category);
      } catch (error) {
        console.warn(`Failed to process article ${article.article_id}:`, error);
      }
    }
  }

  private async processArticle(
    article: NewsDataResponse['results'][0],
    category: string
  ): Promise<void> {
    // Check if article already exists
    const existing = await prisma.news.findFirst({
      where: {
        title: article.title,
        source: article.source_id,
      },
    });

    if (existing) {
      console.log(`Article already exists: ${article.title}`);
      return;
    }

    // Parse publish date
    const publishedAt = new Date(article.pubDate);
    if (isNaN(publishedAt.getTime())) {
      console.warn(`Invalid publish date for article: ${article.title}`);
      return;
    }

    // Extract relevant tags
    const tags = this.extractTags(
      article.title,
      article.description || '',
      article.content || ''
    );

    // Create news record
    await prisma.news.create({
      data: {
        title: article.title.slice(0, 500), // Limit title length
        content: article.content || article.description || '',
        source: article.source_id,
        category: this.mapCategory(category),
        tags,
        publishedAt,
      },
    });

    console.log(`Processed news article: ${article.title}`);
  }

  private extractTags(
    title: string,
    description: string,
    content: string
  ): string[] {
    const text = `${title} ${description} ${content}`.toLowerCase();
    const financialTerms = [
      'mutual fund',
      'sip',
      'equity',
      'debt',
      'hybrid',
      'nifty',
      'sensex',
      'nav',
      'portfolio',
      'investment',
      'dividend',
      'returns',
      'risk',
      'aum',
      'expense ratio',
      'large cap',
      'mid cap',
      'small cap',
      'elss',
      'liquid fund',
    ];

    return financialTerms.filter((term) => text.includes(term));
  }

  private mapCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      business: 'MARKET',
      finance: 'MARKET',
      economy: 'MARKET',
      policy: 'REGULATORY',
      government: 'REGULATORY',
    };

    return categoryMap[category.toLowerCase()] || 'GENERAL';
  }

  async getRecentNews(limit: number = 10): Promise<any[]> {
    try {
      const news = await prisma.news.findMany({
        orderBy: { publishedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          source: true,
          category: true,
          tags: true,
          publishedAt: true,
        },
      });

      return news;
    } catch (error) {
      console.error('Error fetching recent news:', error);
      return [];
    }
  }
}

export const newsService = new NewsService();
