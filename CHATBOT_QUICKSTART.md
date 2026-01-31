# 🤖 AI Chatbot Quick Start Guide

## What You Get

- **1000 Q&A pairs** about Mutual Funds, Stocks, Commodities, Debt Funds, and Financial Calculations
- **Smart similarity search** to find relevant answers
- **Real-time financial calculators** (SIP, Lumpsum, CAGR, Retirement, etc.)
- **Chat history tracking** for analytics
- **RESTful API** ready for frontend integration

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Generate Prisma Client

```powershell
cd "c:\MF root folder\mutual-funds-backend"
npx prisma generate
```

### Step 2: Migrate 1000 Questions to MongoDB

```powershell
npm run migrate:knowledge
```

Expected output:

```
Starting knowledge base migration...
Total questions to migrate: 1000
✓ Successfully migrated: 1000 questions
```

### Step 3: Test the System

```powershell
npm run test:chatbot
```

### Step 4: Start the Server

```powershell
npm run dev
```

Server will be available at: `http://localhost:3002`

---

## 💬 Test the Chatbot

### Using curl (Windows PowerShell):

```powershell
# Ask a question
curl -X POST http://localhost:3002/api/chatbot/ask `
  -H "Content-Type: application/json" `
  -d '{\"query\":\"What is a mutual fund?\"}'

# Calculate SIP (natural language)
curl -X POST http://localhost:3002/api/chatbot/ask `
  -H "Content-Type: application/json" `
  -d '{\"query\":\"Calculate SIP for 5000 monthly for 10 years at 12% returns\"}'

# Direct SIP calculation
curl -X POST http://localhost:3002/api/chatbot/calculate/sip `
  -H "Content-Type: application/json" `
  -d '{\"monthlyInvestment\":5000,\"rateOfReturn\":12,\"years\":10}'

# Get popular questions
curl http://localhost:3002/api/chatbot/popular?limit=5

# Get categories
curl http://localhost:3002/api/chatbot/categories
```

### Using JavaScript/Fetch:

```javascript
// Ask a question
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

---

## 📚 API Endpoints

### Core Endpoints

| Method | Endpoint                          | Description                                 |
| ------ | --------------------------------- | ------------------------------------------- |
| POST   | `/api/chatbot/ask`                | Ask any question (knowledge or calculation) |
| GET    | `/api/chatbot/popular`            | Get most asked questions                    |
| GET    | `/api/chatbot/categories`         | Get all categories                          |
| GET    | `/api/chatbot/category/:name`     | Browse questions by category                |
| GET    | `/api/chatbot/history/:sessionId` | Get chat history                            |

### Calculation Endpoints

| Method | Endpoint                            | Description                 |
| ------ | ----------------------------------- | --------------------------- |
| POST   | `/api/chatbot/calculate/sip`        | Calculate SIP returns       |
| POST   | `/api/chatbot/calculate/lumpsum`    | Calculate lumpsum returns   |
| POST   | `/api/chatbot/calculate/cagr`       | Calculate CAGR              |
| POST   | `/api/chatbot/calculate/retirement` | Calculate retirement corpus |
| POST   | `/api/chatbot/calculate/goal`       | Calculate goal planning     |

---

## 🎯 Example Queries

### Knowledge Questions

- "What is a mutual fund?"
- "How does SIP work?"
- "What is NAV?"
- "Explain expense ratio"
- "What are debt funds?"
- "How to invest in commodities?"
- "What is CAGR?"

### Calculation Questions (Natural Language)

- "Calculate SIP for 5000 monthly for 10 years at 12%"
- "What will be my returns if I invest 100000 lumpsum for 5 years?"
- "Calculate CAGR from 100000 to 200000 in 5 years"
- "How much corpus needed for retirement at age 60?"

### Category Browsing

- Browse "Mutual Funds" category
- Filter by difficulty level (beginner/intermediate/advanced)
- Explore calculation formulas

---

## 📊 Knowledge Base Structure

### Categories (1000 Questions Total)

- **Mutual Funds** - 300 questions (basics, types, selection, risks)
- **Stocks** - 250 questions (equity investing, analysis, strategies)
- **Commodities** - 150 questions (gold, silver, oil, agricultural)
- **Debt Funds** - 100 questions (bonds, fixed income, ratings)
- **Calculations** - 200 questions (SIP, CAGR, returns, tax, planning)

### Difficulty Levels

- **Beginner** - Basic concepts and introductory topics
- **Intermediate** - Detailed analysis and comparison
- **Advanced** - Complex strategies and calculations

---

## 🧮 Available Calculators

1. **SIP Calculator**
   - Monthly investment → Future value
   - Shows: Total invested, returns, percentage gain

2. **Lumpsum Calculator**
   - One-time investment → Future value
   - Compound interest growth

3. **CAGR Calculator**
   - Compounded annual growth rate
   - Total return percentage

4. **SWP Calculator**
   - Systematic withdrawal planning
   - Corpus exhaustion estimation

5. **Expense Ratio Impact**
   - Cost impact on returns

6. **Tax Calculators**
   - LTCG (Long-term capital gains)
   - STCG (Short-term capital gains)

7. **Retirement Planning**
   - Required corpus calculation
   - Inflation adjustment

8. **Goal Planning**
   - Monthly SIP needed
   - Lumpsum needed

9. **Step-up SIP**
   - Annual increment planning

10. **Emergency Fund**
    - Required savings calculation

---

## 🔧 Configuration

### Environment Variables

Ensure these are set in your `.env` or `.env.local`:

```env
DATABASE_URL="mongodb://localhost:27017/mutual-funds"
# or MongoDB Atlas URL
DATABASE_URL="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
```

### Prisma Schema

New models added:

- `KnowledgeBase` - Stores 1000 Q&A pairs
- `ChatHistory` - Tracks all interactions

---

## 📈 How It Works

### Similarity Matching

1. **Jaccard Similarity** (50% weight)
   - Word overlap between query and answer
2. **Keyword Matching** (30% weight)
   - Predefined keywords per question
3. **Exact Phrase Match** (20% weight)
   - Bonus for exact phrase matches

4. **Minimum Threshold: 0.15**
   - Questions below this are filtered out

### Response Structure

```json
{
  "answer": "Formatted markdown answer with definition, points, formula",
  "type": "knowledge|calculation|general",
  "matchedQuestion": {...},
  "relatedQuestions": [...],
  "confidence": 0.95,
  "sources": [...]
}
```

---

## 🎨 Frontend Integration

### React Component Example

```typescript
import { useState } from 'react';

function ChatBot() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');

  const ask = async () => {
    const res = await fetch('http://localhost:3002/api/chatbot/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    setAnswer(data.data.answer);
  };

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={ask}>Ask</button>
      <div dangerouslySetInnerHTML={{ __html: answer }} />
    </div>
  );
}
```

---

## 📝 Database Scripts

### Re-run Migration (if needed)

```powershell
npm run migrate:knowledge
```

### Check Database

```javascript
// Using Prisma Studio
npx prisma studio

// Or MongoDB Compass
// Connect to: mongodb://localhost:27017
// Database: mutual-funds
// Collections: knowledge_base, chat_history
```

### Verify Data

```powershell
npm run test:chatbot
```

---

## 🐛 Troubleshooting

### Issue: "No questions in database"

**Solution:**

```powershell
npx prisma generate
npm run migrate:knowledge
```

### Issue: "Cannot find module"

**Solution:**

```powershell
npm install
npx prisma generate
```

### Issue: "Connection refused"

**Solution:**

- Check if MongoDB is running
- Verify DATABASE_URL in .env
- Test connection: `mongosh` or MongoDB Compass

### Issue: "Low similarity scores"

**Solution:**

- Use more specific keywords
- Include exact terms from questions
- Try different phrasings

---

## 📊 Analytics

### Check Popular Questions

```javascript
GET /api/chatbot/popular?limit=10
```

### View Chat History

```javascript
GET /api/chatbot/history/session123
GET /api/chatbot/user-history/user456?limit=50
```

### Category Statistics

```javascript
GET / api / chatbot / categories;
```

---

## 🔮 Future Enhancements

- [ ] Vector embeddings (OpenAI/Sentence Transformers)
- [ ] Multi-language support (Hindi, regional)
- [ ] Voice interface (speech-to-text)
- [ ] Learning system (user feedback)
- [ ] Advanced calculators (portfolio optimization)
- [ ] Chart generation for calculations
- [ ] PDF report generation

---

## 📚 Documentation

- **Full Guide:** [AI_CHATBOT_GUIDE.md](./AI_CHATBOT_GUIDE.md)
- **API Reference:** See guide for all endpoints
- **Examples:** Test script in `scripts/test-chatbot.ts`

---

## 🎯 Quick Command Reference

```powershell
# Setup
npx prisma generate
npm run migrate:knowledge

# Test
npm run test:chatbot

# Run
npm run dev

# Verify
curl http://localhost:3002/health
curl http://localhost:3002/api/chatbot/categories
```

---

## ✅ Checklist

- [ ] Prisma client generated
- [ ] 1000 questions migrated to MongoDB
- [ ] Test script passes all tests
- [ ] Server running on port 3002
- [ ] API endpoints responding
- [ ] Chat history saving correctly

---

## 💡 Example Use Cases

1. **Educational Platform**
   - Help users learn about investing
   - Provide instant answers to common questions

2. **Investment Advisory**
   - Quick calculations for clients
   - Instant comparison data

3. **Customer Support**
   - Reduce support ticket load
   - 24/7 availability

4. **Mobile App**
   - Chatbot interface
   - Voice-enabled queries

---

**Ready to use!** 🚀

For detailed documentation, see [AI_CHATBOT_GUIDE.md](./AI_CHATBOT_GUIDE.md)
