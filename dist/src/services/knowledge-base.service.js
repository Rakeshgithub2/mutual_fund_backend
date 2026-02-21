/**
 * Knowledge Base Service (JavaScript version)
 * Matches user queries with knowledge base entries using similarity
 * Provides calculation formulas for financial questions
 */

const { mongodb } = require('../db/mongodb');
const { knowledgeBase } = require('../data/knowledge-base-1000-complete');

const COLLECTION_NAME = 'knowledge_base';

/**
 * Calculate Levenshtein distance between two strings (edit distance)
 * Used for fuzzy matching to handle typos and spelling mistakes
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate fuzzy similarity score based on edit distance
 * Returns a score between 0 and 1, where 1 is exact match
 */
function fuzzyMatch(word1, word2) {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();

  if (w1 === w2) return 1.0;

  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(w1, w2);

  // Convert distance to similarity score
  // Allow up to 2 character differences for words longer than 5 characters
  const similarity = 1 - distance / maxLen;

  // Boost score for small typos in longer words
  if (w1.length >= 5 && distance <= 2) {
    return Math.max(similarity, 0.8);
  }

  return similarity;
}

/**
 * Correct common spelling mistakes and typos in query
 */
function correctSpelling(query) {
  let corrected = query.toLowerCase();

  // Common financial terms typo corrections
  const corrections = {
    detb: 'debt',
    dept: 'debt',
    dbet: 'debt',
    comodity: 'commodity',
    commodty: 'commodity',
    commidity: 'commodity',
    mutaul: 'mutual',
    mutal: 'mutual',
    mutial: 'mutual',
    nav: 'nav',
    naav: 'nav',
    nvav: 'nav',
    sip: 'sip',
    syp: 'sip',
    equty: 'equity',
    eqity: 'equity',
    expence: 'expense',
    expnse: 'expense',
    ratoi: 'ratio',
    rtio: 'ratio',
    cagr: 'cagr',
    cgar: 'cagr',
    retrun: 'return',
    retruns: 'returns',
    invesment: 'investment',
    investmnt: 'investment',
    porfolio: 'portfolio',
    portfolo: 'portfolio',
    divdend: 'dividend',
    dividnd: 'dividend',
    intrest: 'interest',
    intrst: 'interest',
    captial: 'capital',
    captal: 'capital',
    goverment: 'government',
    govrment: 'government',
    corporat: 'corporate',
    corporte: 'corporate',
  };

  // Replace words
  const words = corrected.split(/\s+/);
  const correctedWords = words.map((word) => {
    const cleanWord = word.replace(/[^\w]/g, '');
    return corrections[cleanWord] || word;
  });

  const result = correctedWords.join(' ');

  if (result !== query.toLowerCase()) {
    console.log(`🔧 [Spell Correction] "${query}" → "${result}"`);
  }

  return result;
}

/**
 * Calculate text similarity score between two strings with fuzzy matching
 */
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Contains full query
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Word overlap with fuzzy matching
  const words1 = s1.split(/\s+/).filter((w) => w.length > 2);
  const words2 = s2.split(/\s+/).filter((w) => w.length > 2);

  let matchCount = 0;
  let fuzzyMatchCount = 0;

  for (const word1 of words1) {
    let bestMatch = 0;
    for (const word2 of words2) {
      // Exact or substring match
      if (word1.includes(word2) || word2.includes(word1)) {
        matchCount++;
        bestMatch = 1.0;
        break;
      }
      // Fuzzy match for typos (e.g., "detb" matches "debt")
      const fuzzyScore = fuzzyMatch(word1, word2);
      if (fuzzyScore > 0.7 && fuzzyScore > bestMatch) {
        bestMatch = fuzzyScore;
      }
    }
    if (bestMatch > 0.7) {
      fuzzyMatchCount += bestMatch;
    }
  }

  const totalMatches = matchCount + fuzzyMatchCount;
  const maxWords = Math.max(words1.length, words2.length);
  if (maxWords === 0) return 0;

  return totalMatches / maxWords;
}

/**
 * Find best match using in-memory knowledge base (fallback when MongoDB not available)
 */
function findBestMatchInMemory(query) {
  // Apply spelling correction
  const correctedQuery = correctSpelling(query);
  const normalizedQuery = correctedQuery.toLowerCase().trim();

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of knowledgeBase) {
    // Check question similarity with fuzzy matching
    const questionScore = calculateSimilarity(normalizedQuery, entry.question);

    // Check keyword matches with fuzzy matching
    let keywordScore = 0;
    for (const keyword of entry.keywords) {
      const kwScore = calculateSimilarity(normalizedQuery, keyword);
      keywordScore = Math.max(keywordScore, kwScore);
    }

    // Check definition similarity
    const defScore = calculateSimilarity(normalizedQuery, entry.definition);

    // Calculate overall score
    const overallScore = Math.max(
      questionScore * 0.7 + keywordScore * 0.3,
      defScore * 0.4
    );

    if (overallScore > bestScore) {
      bestScore = overallScore;
      bestMatch = entry;
    }
  }

  // Get related questions
  const relatedIds = bestMatch?.relatedQuestions || [];
  const related = knowledgeBase.filter((e) => relatedIds.includes(e.id));

  return {
    entry: bestMatch,
    score: bestScore,
    related,
  };
}

/**
 * Find the best matching knowledge entry for a user query
 */
async function findBestMatch(query) {
  try {
    // Apply spelling correction first
    const correctedQuery = correctSpelling(query);

    // If MongoDB is not connected, use in-memory search
    if (!mongodb.isConnected()) {
      console.log(
        '⚠️  [Knowledge Base] MongoDB not connected, using in-memory search'
      );
      return findBestMatchInMemory(correctedQuery);
    }

    const collection = mongodb.getCollection(COLLECTION_NAME);
    const normalizedQuery = correctedQuery.toLowerCase().trim();

    // Try MongoDB text search first with corrected query
    const results = await collection
      .find(
        { $text: { $search: correctedQuery } },
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(10)
      .toArray();

    let bestMatch = null;
    let bestScore = 0;
    const related = [];

    // Calculate similarity scores for each result
    for (const entry of results) {
      const questionScore = calculateSimilarity(
        normalizedQuery,
        entry.question
      );
      const keywordScore = entry.keywords?.some((k) =>
        normalizedQuery.includes(k.toLowerCase())
      )
        ? 0.6
        : 0;
      const score = Math.max(questionScore, keywordScore);

      if (score > bestScore) {
        if (bestMatch && bestScore >= 0.4) {
          related.push(bestMatch);
        }
        bestMatch = entry;
        bestScore = score;
      } else if (score >= 0.4 && related.length < 3) {
        related.push(entry);
      }
    }

    // If text search didn't find anything, fall back to in-memory search
    if (!bestMatch || bestScore < 0.4) {
      for (const entry of knowledgeBase) {
        const questionScore = calculateSimilarity(
          normalizedQuery,
          entry.question
        );
        const keywordScore = entry.keywords?.some((k) =>
          normalizedQuery.includes(k.toLowerCase())
        )
          ? 0.6
          : 0;
        const score = Math.max(questionScore, keywordScore);

        if (score > bestScore) {
          if (bestMatch && bestScore >= 0.4) {
            related.unshift(bestMatch);
            if (related.length > 3) related.pop();
          }
          bestMatch = entry;
          bestScore = score;
        } else if (score >= 0.4 && related.length < 3) {
          related.push(entry);
        }
      }
    }

    return {
      entry: bestMatch,
      score: bestScore,
      related: related.slice(0, 3),
    };
  } catch (error) {
    console.error('❌ Error finding best match:', error);
    throw error;
  }
}

/**
 * Extract multiple questions from a single query
 */
function extractMultipleQuestions(query) {
  const questions = [];
  const normalizedQuery = query.toLowerCase();

  // Split by common delimiters
  const parts = query.split(/(?:\?|and also|also|,\s*and|,\s*also|\.\s+)/i);

  for (let part of parts) {
    part = part.trim();
    if (part.length > 10) {
      // Minimum length for a meaningful question
      // Add question mark if missing
      if (!part.endsWith('?')) {
        part += '?';
      }
      questions.push(part);
    }
  }

  return questions.length > 1 ? questions : [query];
}

/**
 * Find matches for multiple questions in one query
 */
async function findMultipleMatches(query) {
  const questions = extractMultipleQuestions(query);
  const matches = [];

  for (const question of questions) {
    const result = await findBestMatch(question);
    if (result.entry && result.score >= 0.4) {
      matches.push({
        question: question,
        ...result,
      });
    }
  }

  return matches;
}

/**
 * Check if query is asking for a calculation
 */
function isCalculationQuery(query) {
  const calculationKeywords = [
    'calculate',
    'how to calculate',
    'formula for',
    'how much',
    'what is the return',
    'compute',
  ];

  const normalizedQuery = query.toLowerCase();
  return calculationKeywords.some((keyword) =>
    normalizedQuery.includes(keyword)
  );
}

/**
 * Perform calculation based on query
 */
async function performCalculation(query) {
  const match = await findBestMatch(query);

  if (match.entry && match.entry.formula) {
    return {
      type: 'calculation',
      entry: match.entry,
      score: match.score,
    };
  }

  return null;
}

/**
 * Format knowledge base response
 */
function formatKnowledgeResponse(entry) {
  let response = '';

  if (entry.definition) {
    response += `📖 ${entry.definition}\n\n`;
  }

  if (entry.points && entry.points.length > 0) {
    response += '**Key Points:**\n';
    entry.points.forEach((point, index) => {
      response += `${index + 1}. ${point}\n`;
    });
    response += '\n';
  }

  if (entry.formula) {
    response += `📊 **Formula:** ${entry.formula}\n\n`;
  }

  if (entry.example) {
    response += `💡 **Example:** ${entry.example}\n\n`;
  }

  return response.trim();
}

module.exports = {
  findBestMatch,
  findMultipleMatches,
  extractMultipleQuestions,
  isCalculationQuery,
  performCalculation,
  formatKnowledgeResponse,
};
