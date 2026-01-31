# AI Chatbot with Knowledge Base - Implementation Guide

## Overview

This implementation provides an intelligent AI chatbot that can answer 1000+ questions about mutual funds, stocks, commodities, debt funds, and perform financial calculations. The system uses similarity search to find relevant answers and can perform real-time calculations when needed.

## Features

### 1. **Knowledge Base (1000 Q&A Pairs)**

- 1000 pre-defined questions with detailed answers
- Categories: Mutual Funds, Stocks, Commodities, Debt Funds, Calculations
- Difficulty levels: Beginner, Intermediate, Advanced
- Each entry includes:
  - Question and keywords
  - Definition
  - 5 key points
  - Formula (for calculation questions)
  - Related questions

### 2. **Similarity Search**

- Intelligent matching using:
  - Jaccard similarity (word overlap)
  - Keyword matching
  - Exact phrase detection
- Returns top 5 most relevant questions
- Confidence scoring

### 3. **Financial Calculators**

- SIP (Systematic Investment Plan)
- Lumpsum investment
- CAGR (Compound Annual Growth Rate)
- SWP (Systematic Withdrawal Plan)
- Expense ratio impact
- Tax calculations (LTCG, STCG)
- Emergency fund calculator
- Retirement corpus calculator
- Goal planning
- Step-up SIP
- Debt fund post-tax returns

### 4. **Chat History**

- Stores all chat interactions
- Session-based tracking
- User history
- Popular questions analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Query                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│          Enhanced Chatbot Service                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Detect query type (knowledge/calculation)        │  │
│  │  2. Route to appropriate handler                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────┬──────────────────────────────────┬────────────────┘
          │                                  │
          ▼                                  ▼
┌────────────────────────┐      ┌──────────────────────────┐
│ Knowledge Base Service │      │  Calculation Service     │
│  - Similarity search   │      │  - Parse parameters      │
│  - Find related Q&A    │      │  - Execute formulas      │
│  - Category filtering  │      │  - Format results        │
└────────┬───────────────┘      └──────────┬───────────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    MongoDB Database                          │
│  ┌────────────────────┐  ┌─────────────────────────────┐   │
│  │  KnowledgeBase     │  │  ChatHistory                │   │
│  │  - 1000 Q&A pairs  │  │  - All interactions         │   │
│  │  - Searchable text │  │  - Analytics data           │   │
│  └────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### Step 1: Update Prisma Schema

The schema has been updated with two new models:

- `KnowledgeBase` - Stores 1000 Q&A pairs
- `ChatHistory` - Tracks chat interactions

Run Prisma generate:

```powershell
cd "c:\MF root folder\mutual-funds-backend"
npx prisma generate
```

### Step 2: Migrate Knowledge Base to MongoDB

Run the migration script to load all 1000 questions into MongoDB:

```powershell
# Using npm script (recommended)
npm run migrate:knowledge

# Or with local environment
npm run migrate:knowledge:local

# Or directly with tsx
tsx scripts/migrate-knowledge-base.ts
```

Expected output:

```
Starting knowledge base migration...
Total questions to migrate: 1000
Processing batch 1/10...
Processing batch 2/10...
...
=== Migration Complete ===
✓ Successfully migrated: 1000 questions
✗ Failed: 0 questions

Questions by category:
  Mutual Funds: 300
  Stocks: 250
  Commodities: 150
  Debt Funds: 100
  Calculations: 200
```

### Step 3: Start the Backend Server

```powershell
npm run dev
```

The chatbot will be available at: `http://localhost:3002/api/chatbot`

## API Endpoints

### 1. Ask a Question

**POST** `/api/chatbot/ask`

Request:

```json
{
  "query": "What is a mutual fund?",
  "userId": "optional-user-id",
  "sessionId": "optional-session-id"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "answer": "**What is a mutual fund?**\n\n📖 **Definition:**\nA mutual fund pools money from multiple investors...",
    "type": "knowledge",
    "matchedQuestion": {
      "id": "...",
      "questionId": 1,
      "question": "What is a mutual fund?",
      "definition": "...",
      "points": ["...", "...", "..."],
      "category": "Mutual Funds",
      "level": "beginner",
      "similarity": 0.95
    },
    "relatedQuestions": [...],
    "confidence": 0.95,
    "sources": ["Question ID: 1", "Category: Mutual Funds"]
  }
}
```

### 2. Calculate SIP

**POST** `/api/chatbot/calculate/sip`

Request:

```json
{
  "monthlyInvestment": 5000,
  "rateOfReturn": 12,
  "years": 10
}
```

Response:

```json
{
  "success": true,
  "data": {
    "futureValue": 1162505,
    "totalInvested": 600000,
    "returns": 562505,
    "percentageGain": "93.75"
  }
}
```

### 3. Calculate Lumpsum

**POST** `/api/chatbot/calculate/lumpsum`

Request:

```json
{
  "principal": 100000,
  "rateOfReturn": 12,
  "years": 10
}
```

### 4. Calculate CAGR

**POST** `/api/chatbot/calculate/cagr`

Request:

```json
{
  "beginningValue": 100000,
  "endingValue": 200000,
  "years": 5
}
```

### 5. Get Popular Questions

**GET** `/api/chatbot/popular?limit=10`

Returns the most frequently asked questions.

### 6. Get Categories

**GET** `/api/chatbot/categories`

Returns all knowledge base categories with question counts.

### 7. Browse by Category

**GET** `/api/chatbot/category/Mutual%20Funds?level=beginner`

Returns all questions in a specific category and level.

### 8. Get Chat History

**GET** `/api/chatbot/history/:sessionId`

Returns chat history for a specific session.

### 9. Get User History

**GET** `/api/chatbot/user-history/:userId?limit=50`

Returns chat history for a specific user.

### 10. Calculate Retirement Corpus

**POST** `/api/chatbot/calculate/retirement`

Request:

```json
{
  "currentAge": 30,
  "retirementAge": 60,
  "monthlyExpenses": 50000,
  "inflation": 6,
  "postRetirementReturn": 8
}
```

### 11. Calculate Goal Planning

**POST** `/api/chatbot/calculate/goal`

Request:

```json
{
  "goalAmount": 5000000,
  "yearsToGoal": 10,
  "currentSavings": 100000,
  "expectedReturn": 12
}
```

## Usage Examples

### Example 1: Ask a General Question

```javascript
const response = await fetch('http://localhost:3002/api/chatbot/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'What is NAV in mutual funds?',
    userId: 'user123',
    sessionId: 'session456',
  }),
});

const data = await response.json();
console.log(data.data.answer);
```

### Example 2: Natural Language Calculation

```javascript
const response = await fetch('http://localhost:3002/api/chatbot/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Calculate SIP for 5000 monthly for 10 years at 12% returns',
    userId: 'user123',
  }),
});

const data = await response.json();
console.log(data.data.answer);
// Output: Shows detailed calculation with future value, returns, etc.
```

### Example 3: Get Popular Questions

```javascript
const response = await fetch(
  'http://localhost:3002/api/chatbot/popular?limit=5'
);
const data = await response.json();
console.log(data.data); // Top 5 most asked questions
```

## How It Works

### Similarity Matching Algorithm

1. **Text Preprocessing**
   - Convert query to lowercase
   - Split into words
   - Filter words longer than 2 characters

2. **Jaccard Similarity**
   - Calculate intersection and union of word sets
   - Score = |intersection| / |union|
   - Weight: 50%

3. **Keyword Matching**
   - Check if query contains predefined keywords
   - Score = matched keywords / total keywords
   - Weight: 30%

4. **Exact Phrase Match**
   - Bonus if query exactly matches part of answer
   - Bonus: 20%

5. **Final Score**
   - Combined weighted score (0-1 range)
   - Minimum threshold: 0.15
   - Higher = better match

### Calculation Detection

The system detects calculation queries by looking for keywords:

- calculate, computation, formula
- how much, how to calculate
- CAGR, SIP, lumpsum
- returns, tax, gain, loss
- interest, corpus, maturity

### Answer Building

For each matched question, the response includes:

1. **Definition** - Clear explanation
2. **Key Points** - 5 important points (numbered)
3. **Formula** - Mathematical formula (if applicable)
4. **Category & Level** - Classification
5. **Related Questions** - 3-5 similar questions

## Database Schema

### KnowledgeBase Model

```prisma
model KnowledgeBase {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  questionId Int     @unique
  question  String
  keywords  String[]
  definition String
  points    String[]
  category  String
  level     String
  relatedQuestions Int[]
  formula   String?
  searchableText String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### ChatHistory Model

```prisma
model ChatHistory {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String?  @db.ObjectId
  sessionId String
  question  String
  answer    String
  matchedQuestionId Int?
  similarity Float?
  calculationType String?
  createdAt DateTime @default(now())
}
```

## Testing

### Test 1: Basic Question

```bash
curl -X POST http://localhost:3002/api/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"query":"What is a mutual fund?"}'
```

### Test 2: Calculation

```bash
curl -X POST http://localhost:3002/api/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"query":"Calculate SIP 10000 for 5 years at 12%"}'
```

### Test 3: Direct SIP Calculation

```bash
curl -X POST http://localhost:3002/api/chatbot/calculate/sip \
  -H "Content-Type: application/json" \
  -d '{"monthlyInvestment":10000,"rateOfReturn":12,"years":5}'
```

### Test 4: Get Categories

```bash
curl http://localhost:3002/api/chatbot/categories
```

## Performance Optimization

1. **Indexes**
   - Category index for fast filtering
   - Level index for difficulty-based queries
   - Session index for history retrieval

2. **Caching Strategy** (Future Enhancement)
   - Cache popular questions
   - Cache calculation results for common parameters
   - Use Redis for session data

3. **Search Optimization**
   - Pre-computed searchable text field
   - Efficient text comparison algorithms
   - Batch processing for multiple queries

## Integration with Frontend

### React Component Example

```typescript
import { useState } from 'react';

function AIChatbot() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3002/api/chatbot/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      setResponse(data.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask me anything about mutual funds..."
      />
      <button onClick={handleAsk} disabled={loading}>
        {loading ? 'Thinking...' : 'Ask'}
      </button>
      {response && (
        <div>
          <h3>Answer (Confidence: {(response.confidence * 100).toFixed(0)}%)</h3>
          <pre>{response.answer}</pre>
          {response.relatedQuestions && (
            <div>
              <h4>Related Questions:</h4>
              <ul>
                {response.relatedQuestions.map((q, i) => (
                  <li key={i}>{q.question}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Maintenance

### Adding New Questions

1. Edit `knowledge-base-1000-complete.ts`
2. Add new entries with proper structure
3. Run migration script: `npm run migrate:knowledge`

### Monitoring

- Check chat history for unanswered queries
- Analyze popular questions
- Identify areas needing more Q&A coverage

### Analytics Queries

```typescript
// Most asked questions
const popular = await enhancedChatbotService.getPopularQuestions(10);

// Questions with low confidence matches
const lowConfidence = await prisma.chatHistory.findMany({
  where: { similarity: { lt: 0.3 } },
  orderBy: { createdAt: 'desc' },
  take: 50,
});

// Category distribution
const categories = await enhancedChatbotService.getCategories();
```

## Troubleshooting

### Issue: Migration fails

**Solution:**

- Check MongoDB connection
- Verify DATABASE_URL in .env file
- Run `npx prisma generate` first

### Issue: Low similarity scores

**Solution:**

- Use more specific keywords in queries
- Add synonyms to question keywords
- Lower minimum similarity threshold (currently 0.15)

### Issue: Calculation not detected

**Solution:**

- Include specific numbers in query
- Use keywords like "calculate", "SIP", "lumpsum"
- Try direct calculation endpoints

## Future Enhancements

1. **Vector Embeddings**
   - Use OpenAI embeddings for better semantic search
   - Store embeddings in MongoDB vector search
   - Improve matching accuracy

2. **Multi-language Support**
   - Hindi, regional languages
   - Translation API integration

3. **Voice Interface**
   - Speech-to-text
   - Text-to-speech responses

4. **Learning System**
   - Track user feedback
   - Auto-improve answers
   - Identify knowledge gaps

5. **Advanced Calculators**
   - Portfolio optimization
   - Risk profiling
   - Tax planning
   - Asset allocation

## Support

For issues or questions, check:

- MongoDB connection logs
- Server console output
- Chat history for debugging
- Prisma client errors

---

**Created:** January 2026  
**Version:** 1.0.0  
**Author:** AI Chatbot Implementation Team
