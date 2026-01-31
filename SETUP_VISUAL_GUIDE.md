# 🚀 3-Step Setup Guide

## What You're Building

An AI chatbot that can:

- Answer 1000 questions about investments
- Perform financial calculations
- Learn from conversations
- Suggest related topics

---

## ⚡ Super Quick Start

### Step 1: Generate Database Client (30 seconds)

```powershell
cd "c:\MF root folder\mutual-funds-backend"
npx prisma generate
```

✅ **Done when you see:** "Generated Prisma Client"

---

### Step 2: Load 1000 Questions (1-2 minutes)

```powershell
npm run migrate:knowledge
```

✅ **Done when you see:** "Successfully migrated: 1000 questions"

---

### Step 3: Test Everything (1 minute)

```powershell
npm run test:chatbot
```

✅ **Done when you see:** "All Tests Completed Successfully!"

---

## 🎯 Start Using It

### Option A: Start the Server

```powershell
npm run dev
```

Server runs at: `http://localhost:3002`

### Option B: Test with Curl

```powershell
# Ask a question
curl -X POST http://localhost:3002/api/chatbot/ask `
  -H "Content-Type: application/json" `
  -d '{\"query\":\"What is a mutual fund?\"}'
```

---

## 📊 What's Inside?

### Knowledge Base Categories

| Category        | Questions | Examples                                      |
| --------------- | --------- | --------------------------------------------- |
| 🏦 Mutual Funds | 300       | "What is SIP?", "How NAV works?"              |
| 📈 Stocks       | 250       | "What is PE ratio?", "How to analyze stocks?" |
| 🥇 Commodities  | 150       | "Gold investment", "Silver vs Gold"           |
| 💰 Debt Funds   | 100       | "Fixed income", "Bond ratings"                |
| 🧮 Calculations | 200       | "Calculate SIP", "CAGR formula"               |

### Available Calculators

- SIP (Systematic Investment Plan)
- Lumpsum Returns
- CAGR (Growth Rate)
- Tax Calculations (LTCG/STCG)
- Retirement Planning
- Goal Planning
- Emergency Fund
- And 5 more!

---

## 💬 Try These Questions

### Knowledge Questions

```
"What is a mutual fund?"
"How does SIP work?"
"What is NAV?"
"Explain expense ratio"
"What are debt funds?"
```

### Calculation Questions

```
"Calculate SIP 5000 for 10 years at 12%"
"Lumpsum 100000 for 5 years returns"
"CAGR from 100000 to 200000 in 5 years"
"How much for retirement at age 60?"
```

---

## 🔥 Quick API Reference

### Main Endpoint

```
POST http://localhost:3002/api/chatbot/ask
Body: { "query": "your question here" }
```

### Direct Calculations

```
POST /api/chatbot/calculate/sip
POST /api/chatbot/calculate/lumpsum
POST /api/chatbot/calculate/cagr
POST /api/chatbot/calculate/retirement
POST /api/chatbot/calculate/goal
```

### Browse & Analytics

```
GET /api/chatbot/popular          # Most asked questions
GET /api/chatbot/categories       # All categories
GET /api/chatbot/category/Mutual%20Funds  # Browse category
GET /api/chatbot/history/:sessionId       # Chat history
```

---

## 🎨 Frontend Integration

### React Example

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
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Ask me anything..."
      />
      <button onClick={ask}>Ask</button>
      <div>{answer}</div>
    </div>
  );
}
```

---

## 📁 Files Created

```
mutual-funds-backend/
├── prisma/
│   └── schema.prisma                    # ✅ Updated with KnowledgeBase & ChatHistory
├── scripts/
│   ├── migrate-knowledge-base.ts        # ✅ New - Migration script
│   └── test-chatbot.ts                  # ✅ New - Test script
├── services/
│   ├── knowledge-base.service.ts        # ✅ New - Similarity search
│   ├── calculation.service.ts           # ✅ New - 12+ calculators
│   └── enhanced-chatbot.service.ts      # ✅ New - Main chatbot logic
├── routes/
│   └── chatbot.ts                       # ✅ New - API endpoints
├── src/
│   └── server.ts                        # ✅ Updated - Added chatbot routes
├── package.json                         # ✅ Updated - Added npm scripts
├── AI_CHATBOT_GUIDE.md                  # ✅ New - Complete guide
├── CHATBOT_QUICKSTART.md                # ✅ New - Quick start
└── IMPLEMENTATION_SUMMARY.md            # ✅ New - Summary
```

---

## ✅ Verification Checklist

After running the 3 setup steps, verify:

- [ ] **Database:** `db.knowledge_base.countDocuments()` returns 1000
- [ ] **Server:** Starts without errors
- [ ] **Health:** `curl http://localhost:3002/health` returns 200
- [ ] **API:** Can ask questions and get answers
- [ ] **Calculations:** Can perform SIP/CAGR calculations
- [ ] **History:** Chat interactions are saved

---

## 🆘 Troubleshooting

### Error: "Cannot find module @prisma/client"

```powershell
npx prisma generate
```

### Error: "Connection refused"

Check if MongoDB is running:

```powershell
# Check .env file has DATABASE_URL
# Start MongoDB if needed
```

### Error: "No questions in database"

```powershell
npm run migrate:knowledge
```

### Low Similarity Scores

Use keywords from the knowledge base:

- "mutual fund", "SIP", "NAV", "CAGR"
- "calculate", "returns", "investment"

---

## 📊 System Architecture

```
┌─────────────────┐
│   User Query    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Enhanced Chatbot       │
│  - Detect type          │
│  - Route to handler     │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────┐
│Knowledge│ │Calculator│
│  Base   │ │ Service  │
│ Service │ │          │
└────┬────┘ └────┬─────┘
     │           │
     └─────┬─────┘
           ▼
    ┌──────────────┐
    │   MongoDB    │
    │ - 1000 Q&A   │
    │ - History    │
    └──────────────┘
```

---

## 🎯 Success Metrics

After setup, you should be able to:

- ✅ Ask 1000 different questions
- ✅ Get relevant answers with 80%+ confidence
- ✅ Perform 12+ types of calculations
- ✅ View related questions
- ✅ Track chat history
- ✅ Browse by category
- ✅ See popular questions

---

## 📚 Next Steps

1. **Integrate with Frontend**
   - Add chat widget to your website
   - Create mobile app interface

2. **Customize**
   - Add company-specific questions
   - Customize answer formats
   - Add branding

3. **Enhance**
   - Add voice interface
   - Multi-language support
   - Advanced analytics

4. **Monitor**
   - Track popular questions
   - Identify gaps in knowledge
   - Improve based on feedback

---

## 🎉 You're All Set!

Your AI chatbot is ready to:

- Answer investment questions
- Perform calculations
- Help users learn
- Track interactions

**Start chatting:** `http://localhost:3002/api/chatbot/ask`

For detailed docs: See [AI_CHATBOT_GUIDE.md](./AI_CHATBOT_GUIDE.md)

---

**Time to complete:** ~5 minutes
**Difficulty:** Easy
**Status:** Ready to use! 🚀
