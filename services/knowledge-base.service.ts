/**
 * Knowledge Base Service - Handles similarity search and Q&A retrieval
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SimilarQuestionResult {
  id: string;
  questionId: number;
  question: string;
  definition: string;
  points: string[];
  category: string;
  level: string;
  formula?: string;
  relatedQuestions: number[];
  similarity: number;
}

export class KnowledgeBaseService {
  /**
   * Calculate text similarity using Jaccard similarity and keyword matching
   */
  private calculateSimilarity(
    query: string,
    searchableText: string,
    keywords: string[]
  ): number {
    const queryLower = query.toLowerCase();
    const queryWords = new Set(
      queryLower.split(/\s+/).filter((w) => w.length > 2)
    );
    const textWords = new Set(
      searchableText.split(/\s+/).filter((w) => w.length > 2)
    );

    // Jaccard similarity
    const intersection = new Set(
      [...queryWords].filter((w) => textWords.has(w))
    );
    const union = new Set([...queryWords, ...textWords]);
    const jaccardScore = intersection.size / union.size;

    // Keyword matching bonus
    const keywordMatches = keywords.filter((k) =>
      queryLower.includes(k.toLowerCase())
    ).length;
    const keywordScore = Math.min(keywordMatches / keywords.length, 1);

    // Exact phrase match bonus
    const exactMatchBonus = searchableText.includes(queryLower) ? 0.2 : 0;

    // Combined score (weighted)
    return jaccardScore * 0.5 + keywordScore * 0.3 + exactMatchBonus * 0.2;
  }

  /**
   * Find similar questions based on user query
   */
  async findSimilarQuestions(
    query: string,
    limit: number = 5,
    minSimilarity: number = 0.1
  ): Promise<SimilarQuestionResult[]> {
    try {
      // Get all questions from database
      const allQuestions = await prisma.knowledgeBase.findMany();

      // Calculate similarity for each question
      const scoredQuestions = allQuestions.map((q) => ({
        ...q,
        similarity: this.calculateSimilarity(
          query,
          q.searchableText,
          q.keywords
        ),
      }));

      // Filter and sort by similarity
      const results = scoredQuestions
        .filter((q) => q.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return results.map((r) => ({
        id: r.id,
        questionId: r.questionId,
        question: r.question,
        definition: r.definition,
        points: r.points,
        category: r.category,
        level: r.level,
        formula: r.formula || undefined,
        relatedQuestions: r.relatedQuestions,
        similarity: r.similarity,
      }));
    } catch (error) {
      console.error('Error finding similar questions:', error);
      throw error;
    }
  }

  /**
   * Get question by ID
   */
  async getQuestionById(questionId: number) {
    return await prisma.knowledgeBase.findUnique({
      where: { questionId },
    });
  }

  /**
   * Get related questions
   */
  async getRelatedQuestions(questionIds: number[]) {
    return await prisma.knowledgeBase.findMany({
      where: {
        questionId: {
          in: questionIds,
        },
      },
    });
  }

  /**
   * Search by category
   */
  async searchByCategory(category: string, level?: string) {
    const where: any = { category };
    if (level) {
      where.level = level;
    }

    return await prisma.knowledgeBase.findMany({
      where,
      orderBy: { questionId: 'asc' },
    });
  }

  /**
   * Get all categories
   */
  async getCategories() {
    const result = await prisma.knowledgeBase.groupBy({
      by: ['category'],
      _count: {
        category: true,
      },
    });

    return result.map((r) => ({
      category: r.category,
      count: r._count.category,
    }));
  }

  /**
   * Full-text search across all fields
   */
  async fullTextSearch(searchTerm: string, limit: number = 10) {
    const searchLower = searchTerm.toLowerCase();

    // Search across multiple fields
    const results = await prisma.knowledgeBase.findMany({
      where: {
        OR: [
          { question: { contains: searchLower, mode: 'insensitive' } },
          { definition: { contains: searchLower, mode: 'insensitive' } },
          { keywords: { has: searchLower } },
          { searchableText: { contains: searchLower } },
        ],
      },
      take: limit,
    });

    return results;
  }

  /**
   * Detect if query is calculation-related
   */
  isCalculationQuery(query: string): boolean {
    const calculationKeywords = [
      'calculate',
      'computation',
      'formula',
      'how much',
      'how to calculate',
      'what is the value',
      'compute',
      'determine',
      'find',
      'returns',
      'cagr',
      'sip',
      'lumpsum',
      'expense ratio',
      'nav',
      'corpus',
      'maturity',
      'interest',
      'tax',
      'gain',
      'loss',
      'percentage',
    ];

    const queryLower = query.toLowerCase();
    return calculationKeywords.some((keyword) => queryLower.includes(keyword));
  }

  /**
   * Get calculation questions
   */
  async getCalculationQuestions() {
    return await prisma.knowledgeBase.findMany({
      where: {
        category: 'Calculations',
      },
      orderBy: { questionId: 'asc' },
    });
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
