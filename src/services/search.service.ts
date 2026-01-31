import { Db } from 'mongodb';
import { redis } from '../cache/redis';
import { config } from '../config/environment';

/**
 * Advanced Search Service
 *
 * Multi-layered search approach:
 * 1. Prefix matching - Fast for 1-2 word queries
 * 2. N-gram tokenization - Partial word matching
 * 3. Fuzzy matching - Levenshtein distance (1-2 edits)
 * 4. Intent detection - Tag-based classification
 * 5. Boosting - By AUM, popularity, recency
 */

interface SearchResult {
  fundId: string;
  name: string;
  fundHouse: string;
  category: string;
  subCategory: string;
  fundType: string;
  currentNav: number;
  aum: number;
  popularity: number;
  tags: string[];
  score: number;
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'tag';
  confidence?: number; // 0-1 confidence score for autocomplete
  highlightedName?: string; // HTML with <mark> tags for matched substrings
  matchedTokens?: string[]; // Which input tokens matched
}

interface SearchOptions {
  limit?: number;
  category?: string;
  minAum?: number;
  enableFuzzy?: boolean;
  boostPopular?: boolean;
}

export class SearchService {
  private db: Db;

  // Intent keywords for tag-based search
  private readonly intentKeywords = {
    gold: ['gold', 'goldbees', 'commodity', 'precious'],
    silver: ['silver', 'silverbees'],
    equity: [
      'equity',
      'stock',
      'large cap',
      'mid cap',
      'small cap',
      'multicap',
    ],
    debt: ['debt', 'bond', 'fixed income', 'liquid'],
    hybrid: ['hybrid', 'balanced', 'aggressive hybrid'],
    international: ['international', 'us', 'global', 'emerging'],
    sectoral: ['banking', 'pharma', 'tech', 'auto', 'infrastructure', 'energy'],
    index: ['index', 'nifty', 'sensex', 'etf'],
  };

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Main search method with multi-layered approach
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 10,
      category,
      minAum,
      enableFuzzy = true,
      boostPopular = true,
    } = options;

    const normalizedQuery = query.trim().toLowerCase();

    // Check cache first
    const cacheKey = `search:advanced:${normalizedQuery}:${JSON.stringify(options)}`;
    const cached = await redis.get<SearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const results: SearchResult[] = [];

    // Layer 1: Exact match (highest priority)
    const exactMatches = await this.exactMatch(
      normalizedQuery,
      category,
      minAum
    );
    results.push(
      ...exactMatches.map((r) => ({
        ...r,
        score: r.score * 1.5,
        matchType: 'exact' as const,
      }))
    );

    // Layer 2: Prefix match
    if (results.length < limit) {
      const prefixMatches = await this.prefixMatch(
        normalizedQuery,
        category,
        minAum
      );
      results.push(
        ...prefixMatches.map((r) => ({
          ...r,
          score: r.score * 1.2,
          matchType: 'prefix' as const,
        }))
      );
    }

    // Layer 3: Fuzzy match (if enabled)
    if (enableFuzzy && results.length < limit && normalizedQuery.length >= 3) {
      const fuzzyMatches = await this.fuzzyMatch(
        normalizedQuery,
        category,
        minAum
      );
      results.push(
        ...fuzzyMatches.map((r) => ({ ...r, matchType: 'fuzzy' as const }))
      );
    }

    // Layer 4: Intent-based tag search
    if (results.length < limit) {
      const tagMatches = await this.intentBasedSearch(
        normalizedQuery,
        category,
        minAum
      );
      results.push(
        ...tagMatches.map((r) => ({
          ...r,
          score: r.score * 0.8,
          matchType: 'tag' as const,
        }))
      );
    }

    // Remove duplicates (keep highest score)
    const uniqueResults = this.deduplicateResults(results);

    // Apply boosting
    const boostedResults = boostPopular
      ? this.applyBoosting(uniqueResults)
      : uniqueResults;

    // Sort by score and limit
    const finalResults = boostedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Cache for 30 minutes
    await redis.set(cacheKey, finalResults, 30 * 60);

    return finalResults;
  }

  /**
   * Enhanced autocomplete with intelligent tokenization for 1-2 words
   *
   * Behavior:
   * - 1 word: prefix + fuzzy + tag boost for symbols
   * - 2 words: treat as [brand] [strategy] or [fund name] [type]
   *   Try permutations and return best matches
   *
   * Example: "sbi small" → "SBI Small Cap Fund - Regular Plan"
   *
   * Returns confidence score and highlighted matched substrings
   */
  async suggest(prefix: string, limit: number = 10): Promise<SearchResult[]> {
    const normalizedPrefix = prefix.trim().toLowerCase();

    if (normalizedPrefix.length < 2) {
      return [];
    }

    // Check cache
    const cacheKey = `suggest:v2:${normalizedPrefix}:${limit}`;
    const cached = await redis.get<SearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Tokenize input
    const tokens = this.tokenizeQuery(normalizedPrefix);
    const wordCount = tokens.length;

    let suggestions: SearchResult[] = [];

    if (wordCount === 1) {
      // Single word: prefix + fuzzy + tag boost
      suggestions = await this.suggestSingleWord(tokens[0], limit);
    } else if (wordCount === 2) {
      // Two words: try permutations [brand] [strategy] or [fund] [type]
      suggestions = await this.suggestTwoWords(tokens[0], tokens[1], limit);
    } else {
      // 3+ words: use standard autocomplete
      if (config.features.enableAtlasSearch) {
        suggestions = await this.atlasAutocomplete(normalizedPrefix, limit);
      } else {
        suggestions = await this.ngramSuggest(normalizedPrefix, limit);
      }
    }

    // Add confidence scores and highlighting
    suggestions = suggestions.map((s) =>
      this.enrichAutocompleteResult(s, tokens, normalizedPrefix)
    );

    // Sort by confidence
    suggestions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    // Cache for 1 hour
    await redis.set(cacheKey, suggestions, 60 * 60);

    return suggestions.slice(0, limit);
  }

  // ==================== LAYER 1: EXACT MATCH ====================

  private async exactMatch(
    query: string,
    category?: string,
    minAum?: number
  ): Promise<SearchResult[]> {
    const filter: any = {
      isActive: true,
      $or: [
        { name: { $regex: `^${this.escapeRegex(query)}$`, $options: 'i' } },
        { fundId: query.toUpperCase() },
      ],
    };

    if (category) filter.category = category;
    if (minAum) filter.aum = { $gte: minAum };

    const results = await this.db
      .collection('funds')
      .find(filter)
      .limit(5)
      .project(this.getProjection())
      .toArray();

    return this.mapToSearchResults(results, 100);
  }

  // ==================== LAYER 2: PREFIX MATCH ====================

  private async prefixMatch(
    query: string,
    category?: string,
    minAum?: number
  ): Promise<SearchResult[]> {
    const filter: any = {
      isActive: true,
      $or: [
        { name: { $regex: `^${this.escapeRegex(query)}`, $options: 'i' } },
        { fundHouse: { $regex: `^${this.escapeRegex(query)}`, $options: 'i' } },
        {
          searchTerms: { $regex: `^${this.escapeRegex(query)}`, $options: 'i' },
        },
      ],
    };

    if (category) filter.category = category;
    if (minAum) filter.aum = { $gte: minAum };

    const results = await this.db
      .collection('funds')
      .find(filter)
      .sort({ popularity: -1, aum: -1 })
      .limit(10)
      .project(this.getProjection())
      .toArray();

    return this.mapToSearchResults(results, 80);
  }

  // ==================== LAYER 3: FUZZY MATCH ====================

  private async fuzzyMatch(
    query: string,
    category?: string,
    minAum?: number
  ): Promise<SearchResult[]> {
    if (config.features.enableAtlasSearch) {
      return this.atlasFuzzySearch(query, category, minAum);
    }

    // Fallback: MongoDB text search
    const filter: any = {
      $text: { $search: query },
      isActive: true,
    };

    if (category) filter.category = category;
    if (minAum) filter.aum = { $gte: minAum };

    const results = await this.db
      .collection('funds')
      .find(filter)
      .sort({ score: { $meta: 'textScore' } })
      .limit(10)
      .project({ ...this.getProjection(), score: { $meta: 'textScore' } })
      .toArray();

    // Apply Levenshtein distance for additional fuzzy matching
    const fuzzyResults = results
      .map((result) => {
        const nameDistance = this.levenshteinDistance(
          query,
          result.name.toLowerCase()
        );
        const fundHouseDistance = this.levenshteinDistance(
          query,
          result.fundHouse.toLowerCase()
        );
        const minDistance = Math.min(nameDistance, fundHouseDistance);

        // Accept if within 2 edits
        const fuzzyScore =
          minDistance <= 2 ? (1 - minDistance / query.length) * 100 : 0;

        return {
          ...result,
          score: fuzzyScore,
        };
      })
      .filter((r) => r.score > 0);

    return this.mapToSearchResults(fuzzyResults, 60);
  }

  // ==================== LAYER 4: INTENT-BASED SEARCH ====================

  private async intentBasedSearch(
    query: string,
    category?: string,
    minAum?: number
  ): Promise<SearchResult[]> {
    const detectedTags = this.detectIntent(query);

    if (detectedTags.length === 0) {
      return [];
    }

    const filter: any = {
      isActive: true,
      tags: { $in: detectedTags },
    };

    if (category) filter.category = category;
    if (minAum) filter.aum = { $gte: minAum };

    const results = await this.db
      .collection('funds')
      .find(filter)
      .sort({ popularity: -1, aum: -1 })
      .limit(15)
      .project(this.getProjection())
      .toArray();

    return this.mapToSearchResults(results, 50);
  }

  // ==================== ATLAS SEARCH METHODS ====================

  private async atlasAutocomplete(
    prefix: string,
    limit: number
  ): Promise<SearchResult[]> {
    const results = await this.db
      .collection('funds')
      .aggregate([
        {
          $search: {
            index: 'funds_search',
            autocomplete: {
              query: prefix,
              path: 'name',
              fuzzy: {
                maxEdits: 1,
                prefixLength: 2,
              },
            },
          },
        },
        {
          $match: { isActive: true },
        },
        {
          $limit: limit,
        },
        {
          $project: {
            ...this.getProjection(),
            score: { $meta: 'searchScore' },
          },
        },
      ])
      .toArray();

    return this.mapToSearchResults(results);
  }

  private async atlasFuzzySearch(
    query: string,
    category?: string,
    minAum?: number
  ): Promise<SearchResult[]> {
    const matchStage: any = { isActive: true };
    if (category) matchStage.category = category;
    if (minAum) matchStage.aum = { $gte: minAum };

    const results = await this.db
      .collection('funds')
      .aggregate([
        {
          $search: {
            index: 'funds_search',
            text: {
              query: query,
              path: ['name', 'fundHouse', 'searchTerms', 'tags'],
              fuzzy: {
                maxEdits: 2,
                prefixLength: 2,
              },
            },
          },
        },
        {
          $match: matchStage,
        },
        {
          $limit: 10,
        },
        {
          $project: {
            ...this.getProjection(),
            score: { $meta: 'searchScore' },
          },
        },
      ])
      .toArray();

    return this.mapToSearchResults(results);
  }

  // ==================== N-GRAM SUGGESTIONS ====================

  private async ngramSuggest(
    prefix: string,
    limit: number
  ): Promise<SearchResult[]> {
    // Generate n-grams for the prefix
    const ngrams = this.generateNGrams(prefix, 2, 3);

    const filter: any = {
      isActive: true,
      $or: [
        { name: { $regex: `^${this.escapeRegex(prefix)}`, $options: 'i' } },
        { searchTerms: { $in: ngrams } },
      ],
    };

    const results = await this.db
      .collection('funds')
      .find(filter)
      .sort({ popularity: -1 })
      .limit(limit)
      .project(this.getProjection())
      .toArray();

    return this.mapToSearchResults(results, 70);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Detect user intent from query
   */
  private detectIntent(query: string): string[] {
    const tags: string[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [tag, keywords] of Object.entries(this.intentKeywords)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          tags.push(tag);
          break;
        }
      }
    }

    return tags;
  }

  /**
   * Apply boosting based on AUM, popularity, and recency
   */
  private applyBoosting(results: SearchResult[]): SearchResult[] {
    return results.map((result) => {
      let boost = 1;

      // Boost by AUM (normalized to 0-1 range)
      const aumBoost = Math.min(result.aum / 10000000000, 1) * 0.3; // Max 30% boost

      // Boost by popularity (normalized to 0-1 range)
      const popularityBoost = Math.min(result.popularity / 1000, 1) * 0.2; // Max 20% boost

      boost += aumBoost + popularityBoost;

      return {
        ...result,
        score: result.score * boost,
      };
    });
  }

  /**
   * Remove duplicate results, keeping highest score
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>();

    for (const result of results) {
      const existing = seen.get(result.fundId);
      if (!existing || result.score > existing.score) {
        seen.set(result.fundId, result);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Levenshtein distance algorithm for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Generate n-grams for partial matching
   */
  private generateNGrams(text: string, minN: number, maxN: number): string[] {
    const ngrams: string[] = [];
    const words = text.toLowerCase().split(/\s+/);

    for (const word of words) {
      for (let n = minN; n <= Math.min(maxN, word.length); n++) {
        for (let i = 0; i <= word.length - n; i++) {
          ngrams.push(word.substring(i, i + n));
        }
      }
    }

    return [...new Set(ngrams)];
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get projection for search results
   */
  private getProjection(): any {
    return {
      fundId: 1,
      name: 1,
      fundHouse: 1,
      category: 1,
      subCategory: 1,
      fundType: 1,
      currentNav: 1,
      aum: 1,
      popularity: 1,
      tags: 1,
      _id: 0,
    };
  }

  /**
   * Map database results to SearchResult objects
   */
  private mapToSearchResults(
    results: any[],
    baseScore: number = 50
  ): SearchResult[] {
    return results.map((result) => ({
      fundId: result.fundId,
      name: result.name,
      fundHouse: result.fundHouse,
      category: result.category,
      subCategory: result.subCategory,
      fundType: result.fundType,
      currentNav: result.currentNav,
      aum: result.aum,
      popularity: result.popularity || 0,
      tags: result.tags || [],
      score: result.score || baseScore,
      matchType: 'prefix' as const,
    }));
  }

  // ==================== ENHANCED AUTOCOMPLETE METHODS ====================

  /**
   * Tokenize query into words
   */
  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * Single word autocomplete: prefix + fuzzy + tag boost
   */
  private async suggestSingleWord(
    word: string,
    limit: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // 1. Prefix match on name and fundHouse (highest priority)
    const prefixResults = await this.db
      .collection('funds')
      .find({
        isActive: true,
        $or: [
          { name: { $regex: `^${this.escapeRegex(word)}`, $options: 'i' } },
          {
            fundHouse: { $regex: `^${this.escapeRegex(word)}`, $options: 'i' },
          },
          { fundId: { $regex: `^${this.escapeRegex(word.toUpperCase())}` } },
        ],
      })
      .sort({ popularity: -1, aum: -1 })
      .limit(limit)
      .project(this.getProjection())
      .toArray();

    results.push(...this.mapToSearchResults(prefixResults, 90));

    // 2. Fuzzy match on name (if not enough results)
    if (results.length < limit) {
      const fuzzyResults = await this.db
        .collection('funds')
        .find({
          isActive: true,
          name: { $regex: this.escapeRegex(word), $options: 'i' },
        })
        .sort({ popularity: -1 })
        .limit(limit - results.length)
        .project(this.getProjection())
        .toArray();

      results.push(...this.mapToSearchResults(fuzzyResults, 70));
    }

    // 3. Tag-based match with boost for symbols (gold, silver, etc.)
    const tags = this.detectIntent(word);
    if (tags.length > 0 && results.length < limit) {
      const tagResults = await this.db
        .collection('funds')
        .find({
          isActive: true,
          tags: { $in: tags },
        })
        .sort({ popularity: -1 })
        .limit(limit - results.length)
        .project(this.getProjection())
        .toArray();

      results.push(
        ...this.mapToSearchResults(tagResults, 80).map((r) => ({
          ...r,
          // Boost symbol matches (gold, silver)
          score: tags.some((t) => ['gold', 'silver'].includes(t))
            ? r.score * 1.3
            : r.score,
        }))
      );
    }

    return this.deduplicateResults(results);
  }

  /**
   * Two word autocomplete: try permutations [brand] [strategy] or [fund] [type]
   * Example: "sbi small" → "SBI Small Cap Fund"
   */
  private async suggestTwoWords(
    word1: string,
    word2: string,
    limit: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Pattern 1: [brand] [strategy] - e.g., "sbi small" → "SBI Small Cap"
    const brandStrategy = await this.db
      .collection('funds')
      .find({
        isActive: true,
        $and: [
          {
            $or: [
              { fundHouse: { $regex: this.escapeRegex(word1), $options: 'i' } },
              {
                name: { $regex: `^${this.escapeRegex(word1)}`, $options: 'i' },
              },
            ],
          },
          {
            name: { $regex: this.escapeRegex(word2), $options: 'i' },
          },
        ],
      })
      .sort({ popularity: -1, aum: -1 })
      .limit(limit)
      .project(this.getProjection())
      .toArray();

    results.push(...this.mapToSearchResults(brandStrategy, 95));

    // Pattern 2: Reversed - [strategy] [brand] - e.g., "small sbi"
    if (results.length < limit) {
      const strategyBrand = await this.db
        .collection('funds')
        .find({
          isActive: true,
          $and: [
            {
              $or: [
                {
                  fundHouse: { $regex: this.escapeRegex(word2), $options: 'i' },
                },
                {
                  name: {
                    $regex: `^${this.escapeRegex(word2)}`,
                    $options: 'i',
                  },
                },
              ],
            },
            {
              name: { $regex: this.escapeRegex(word1), $options: 'i' },
            },
          ],
        })
        .sort({ popularity: -1 })
        .limit(limit - results.length)
        .project(this.getProjection())
        .toArray();

      results.push(...this.mapToSearchResults(strategyBrand, 85));
    }

    // Pattern 3: Both words in name (consecutive or non-consecutive)
    if (results.length < limit) {
      const bothInName = await this.db
        .collection('funds')
        .find({
          isActive: true,
          name: {
            $regex: `${this.escapeRegex(word1)}.*${this.escapeRegex(word2)}|${this.escapeRegex(word2)}.*${this.escapeRegex(word1)}`,
            $options: 'i',
          },
        })
        .sort({ popularity: -1 })
        .limit(limit - results.length)
        .project(this.getProjection())
        .toArray();

      results.push(...this.mapToSearchResults(bothInName, 80));
    }

    // Pattern 4: Category/subCategory match
    const categoryKeywords = {
      large: 'Large Cap',
      mid: 'Mid Cap',
      small: 'Small Cap',
      multi: 'Multi Cap',
      flexi: 'Flexi Cap',
      hybrid: 'Hybrid',
      debt: 'Debt',
      liquid: 'Liquid',
      gilt: 'Gilt',
    };

    const categoryMatch =
      categoryKeywords[word2 as keyof typeof categoryKeywords];
    if (categoryMatch && results.length < limit) {
      const categoryResults = await this.db
        .collection('funds')
        .find({
          isActive: true,
          fundHouse: { $regex: this.escapeRegex(word1), $options: 'i' },
          subCategory: {
            $regex: this.escapeRegex(categoryMatch),
            $options: 'i',
          },
        })
        .sort({ popularity: -1 })
        .limit(limit - results.length)
        .project(this.getProjection())
        .toArray();

      results.push(...this.mapToSearchResults(categoryResults, 90));
    }

    return this.deduplicateResults(results);
  }

  /**
   * Enrich autocomplete result with confidence score and highlighting
   */
  private enrichAutocompleteResult(
    result: SearchResult,
    tokens: string[],
    originalQuery: string
  ): SearchResult {
    // Calculate confidence score
    const confidence = this.calculateConfidence(result, tokens, originalQuery);

    // Generate highlighted name
    const highlightedName = this.highlightMatches(result.name, tokens);

    // Determine which tokens matched
    const matchedTokens = tokens.filter((token) =>
      result.name.toLowerCase().includes(token)
    );

    return {
      ...result,
      confidence,
      highlightedName,
      matchedTokens,
    };
  }

  /**
   * Calculate confidence score (0-1) based on match quality
   */
  private calculateConfidence(
    result: SearchResult,
    tokens: string[],
    originalQuery: string
  ): number {
    let confidence = 0;

    const nameLower = result.name.toLowerCase();
    const fundHouseLower = result.fundHouse.toLowerCase();

    // Factor 1: Exact prefix match (highest confidence)
    if (nameLower.startsWith(originalQuery)) {
      confidence += 0.5;
    } else if (fundHouseLower.startsWith(originalQuery)) {
      confidence += 0.4;
    }

    // Factor 2: All tokens present
    const allTokensPresent = tokens.every((token) => nameLower.includes(token));
    if (allTokensPresent) {
      confidence += 0.3;
    } else {
      // Partial match
      const matchedCount = tokens.filter((t) => nameLower.includes(t)).length;
      confidence += (matchedCount / tokens.length) * 0.2;
    }

    // Factor 3: Token order preserved
    if (tokens.length === 2) {
      const index1 = nameLower.indexOf(tokens[0]);
      const index2 = nameLower.indexOf(tokens[1]);
      if (index1 >= 0 && index2 >= 0 && index1 < index2) {
        confidence += 0.1;
      }
    }

    // Factor 4: Popularity boost
    if (result.popularity > 80) {
      confidence += 0.05;
    } else if (result.popularity > 50) {
      confidence += 0.03;
    }

    // Factor 5: AUM boost (larger funds are often what users look for)
    if (result.aum > 10000) {
      confidence += 0.05;
    } else if (result.aum > 5000) {
      confidence += 0.02;
    }

    return Math.min(1, confidence);
  }

  /**
   * Highlight matched substrings with <mark> tags
   */
  private highlightMatches(name: string, tokens: string[]): string {
    let highlighted = name;

    // Sort tokens by length (longest first) to avoid partial replacements
    const sortedTokens = [...tokens].sort((a, b) => b.length - a.length);

    for (const token of sortedTokens) {
      const regex = new RegExp(`(${this.escapeRegex(token)})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    }

    return highlighted;
  }
}
