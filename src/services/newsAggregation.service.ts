import axios from 'axios';
import { mongodb } from '../db/mongodb';
import { News } from '../db/schemas';
import * as cheerio from 'cheerio';

/**
 * VERIFIED NEWS AGGREGATION SERVICE
 *
 * Aggregates mutual fund and market news from verified Indian sources:
 * - Source attribution
 * - Verified sources only
 * - No promotional content
 * - Mobile-friendly summaries
 */
export class NewsAggregationService {
  private static instance: NewsAggregationService;

  /**
   * Verified Indian financial news sources
   */
  private readonly verifiedSources = [
    {
      name: 'Economic Times',
      baseUrl: 'https://economictimes.indiatimes.com',
      rssUrl:
        'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
      verified: true,
    },
    {
      name: 'LiveMint',
      baseUrl: 'https://www.livemint.com',
      rssUrl: 'https://www.livemint.com/rss/markets',
      verified: true,
    },
    {
      name: 'Business Standard',
      baseUrl: 'https://www.business-standard.com',
      rssUrl: 'https://www.business-standard.com/rss/markets-106.rss',
      verified: true,
    },
    {
      name: 'MoneyControl',
      baseUrl: 'https://www.moneycontrol.com',
      rssUrl: 'https://www.moneycontrol.com/rss/mfnews.xml',
      verified: true,
    },
    {
      name: 'Value Research',
      baseUrl: 'https://www.valueresearchonline.com',
      verified: true,
    },
  ];

  private constructor() {}

  public static getInstance(): NewsAggregationService {
    if (!NewsAggregationService.instance) {
      NewsAggregationService.instance = new NewsAggregationService();
    }
    return NewsAggregationService.instance;
  }

  /**
   * Fetch latest news from all verified sources
   */
  async fetchLatestNews(limit: number = 50): Promise<News[]> {
    const newsCollection = mongodb.getCollection<News>('news');

    // Get recent news from DB first (cached)
    const recentNews = await newsCollection
      .find({
        sourceVerified: true,
        isPromotional: false,
      })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .toArray();

    // If we have fresh news (< 1 hour old), return it
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const freshNews = recentNews.filter(
      (news) => news.publishedAt >= oneHourAgo
    );

    if (freshNews.length >= 10) {
      return recentNews;
    }

    // Otherwise, fetch new news
    await this.aggregateNewsFromAllSources();

    // Return updated news
    return await newsCollection
      .find({
        sourceVerified: true,
        isPromotional: false,
      })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Aggregate news from all sources
   */
  async aggregateNewsFromAllSources(): Promise<void> {
    console.log('📰 Aggregating news from verified sources...');

    for (const source of this.verifiedSources) {
      try {
        if (source.rssUrl) {
          await this.fetchFromRSS(source);
        }
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
      }
    }

    console.log('✅ News aggregation completed');
  }

  /**
   * Fetch news from RSS feed
   */
  private async fetchFromRSS(
    source: (typeof this.verifiedSources)[0]
  ): Promise<void> {
    try {
      const response = await axios.get(source.rssUrl!, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const newsCollection = mongodb.getCollection<News>('news');

      const items = $('item');
      console.log(`Found ${items.length} items from ${source.name}`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const title = $(item).find('title').text();
        const link = $(item).find('link').text();
        const description = $(item).find('description').text();
        const pubDate = $(item).find('pubDate').text();

        if (!title || !link) continue;

        // Generate newsId from URL
        const newsId = this.generateNewsId(link);

        // Check if already exists
        const exists = await newsCollection.findOne({ newsId });
        if (exists) continue;

        // Categorize news
        const category = this.categorizeNews(title, description);

        // Extract related entities
        const related = this.extractRelatedEntities(title + ' ' + description);

        // Create summary
        const summary = this.createSummary(description || title);

        // Check if promotional
        const isPromotional = this.isPromotionalContent(title, description);

        const news: News = {
          newsId,
          title,
          content: description || title,
          summary,
          source: source.name,
          sourceUrl: link,
          sourceVerified: source.verified,
          category,
          tags: this.extractTags(title + ' ' + description),
          relatedFunds: related.funds,
          relatedAMCs: related.amcs,
          relatedIndices: related.indices,
          publishedAt: new Date(pubDate),
          scrapedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          views: 0,
          isPromotional,
          isFeatured: false,
        };

        await newsCollection.insertOne(news);
      }

      console.log(`✅ Processed news from ${source.name}`);
    } catch (error: any) {
      console.error(`Error processing RSS from ${source.name}:`, error.message);
    }
  }

  /**
   * Generate unique news ID from URL
   */
  private generateNewsId(url: string): string {
    // Extract unique part from URL or generate hash
    const match = url.match(/\/([a-zA-Z0-9-]+)$/);
    if (match) {
      return match[1];
    }
    // Fallback: use hash of URL
    return Buffer.from(url).toString('base64').substring(0, 32);
  }

  /**
   * Categorize news based on content
   */
  private categorizeNews(title: string, description: string): News['category'] {
    const text = (title + ' ' + description).toLowerCase();

    if (
      text.includes('mutual fund') ||
      text.includes('mf') ||
      text.includes('sip')
    ) {
      return 'mutual_fund';
    }
    if (
      text.includes('nifty') ||
      text.includes('sensex') ||
      text.includes('equity')
    ) {
      return 'equity_market';
    }
    if (
      text.includes('debt') ||
      text.includes('bond') ||
      text.includes('gilt')
    ) {
      return 'debt_market';
    }
    if (
      text.includes('gold') ||
      text.includes('silver') ||
      text.includes('commodity')
    ) {
      return 'commodity';
    }
    if (text.includes('amc') || text.includes('asset management')) {
      return 'amc_announcement';
    }
    if (
      text.includes('sebi') ||
      text.includes('regulation') ||
      text.includes('regulatory')
    ) {
      return 'regulatory';
    }

    return 'general';
  }

  /**
   * Extract tags from text
   */
  private extractTags(text: string): string[] {
    const tags: string[] = [];
    const lowerText = text.toLowerCase();

    // Common tags
    const tagPatterns = [
      'nifty',
      'sensex',
      'bank nifty',
      'mutual fund',
      'sip',
      'equity',
      'debt',
      'hybrid',
      'sebi',
      'amc',
      'nav',
      'returns',
      'tax',
      'elss',
      'large cap',
      'mid cap',
      'small cap',
      'gold',
      'etf',
      'index fund',
    ];

    for (const pattern of tagPatterns) {
      if (lowerText.includes(pattern)) {
        tags.push(pattern);
      }
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Extract related entities (funds, AMCs, indices)
   */
  private extractRelatedEntities(text: string): {
    funds: string[];
    amcs: string[];
    indices: string[];
  } {
    const lowerText = text.toLowerCase();

    // Extract AMCs
    const amcs: string[] = [];
    const amcPatterns = [
      'hdfc',
      'icici',
      'sbi',
      'axis',
      'kotak',
      'nippon',
      'aditya birla',
    ];
    for (const amc of amcPatterns) {
      if (lowerText.includes(amc)) {
        amcs.push(amc);
      }
    }

    // Extract indices
    const indices: string[] = [];
    const indexPatterns = ['nifty 50', 'sensex', 'bank nifty', 'nifty next 50'];
    for (const index of indexPatterns) {
      if (lowerText.includes(index)) {
        indices.push(index);
      }
    }

    return {
      funds: [], // TODO: Match against fund names in DB
      amcs,
      indices,
    };
  }

  /**
   * Create mobile-friendly summary (max 150 characters)
   */
  private createSummary(content: string): string {
    // Remove HTML tags
    const text = content.replace(/<[^>]*>/g, '');

    // Trim to 150 characters
    if (text.length <= 150) {
      return text;
    }

    // Find last complete sentence within 150 chars
    const trimmed = text.substring(0, 150);
    const lastPeriod = trimmed.lastIndexOf('.');
    const lastSpace = trimmed.lastIndexOf(' ');

    if (lastPeriod > 100) {
      return trimmed.substring(0, lastPeriod + 1);
    } else if (lastSpace > 100) {
      return trimmed.substring(0, lastSpace) + '...';
    }

    return trimmed + '...';
  }

  /**
   * Check if content is promotional
   */
  private isPromotionalContent(title: string, description: string): boolean {
    const text = (title + ' ' + description).toLowerCase();

    const promotionalKeywords = [
      'invest now',
      'best investment',
      'hurry',
      'limited time',
      'special offer',
      'guaranteed returns',
      'risk-free',
      'assured returns',
    ];

    return promotionalKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Get news by category
   */
  async getNewsByCategory(
    category: News['category'],
    limit: number = 20
  ): Promise<News[]> {
    const newsCollection = mongodb.getCollection<News>('news');

    return await newsCollection
      .find({
        category,
        sourceVerified: true,
        isPromotional: false,
      })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Search news
   */
  async searchNews(query: string, limit: number = 20): Promise<News[]> {
    const newsCollection = mongodb.getCollection<News>('news');

    return await newsCollection
      .find({
        $text: { $search: query },
        sourceVerified: true,
        isPromotional: false,
      })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .toArray();
  }
}

export const newsAggregationService = NewsAggregationService.getInstance();
