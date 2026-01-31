# Knowledge Base Expansion: 100 → 1000 Questions

## Current Status

- ✅ **100 questions** manually created with full definitions and bullet points
- ✅ Successfully seeded to MongoDB
- ✅ AI chatbot integrated with knowledge base
- 🔄 **900 questions** pending with auto-generation script ready

## The Challenge

Creating 1000 questions with:

- Clear one-line definition
- 5-7 bullet points each
- Keywords for matching
- Category and difficulty level
- Related questions
- Formulas where applicable

**Manual creation time**: ~5 minutes per question = **83 hours total** ❌

## The Solution: AI-Powered Auto-Generation

### Script: `generate-1000-questions.ts`

Uses Google Gemini AI to automatically generate complete answers for all 1000 questions.

### Features:

1. **Structured Question Bank**: Pre-organized questions by category
   - Mutual Funds: 300 questions
   - Stocks: 200 questions
   - Commodities: 150 questions
   - Debt Funds: 150 questions
   - Calculations: 200 questions

2. **AI-Generated Content**: Each question gets:
   - One-line definition (max 25 words)
   - 5-7 practical bullet points (max 15 words each)
   - Formula (if applicable)
   - Keywords extracted automatically
   - Difficulty level determined by content

3. **Indian Context**: All answers include:
   - ₹ (Rupee) currency
   - SEBI regulations
   - Indian tax rules (2026)
   - NSE/BSE/MCX references
   - Indian investment instruments

4. **Rate Limiting**:
   - Processes 10 questions, then 2-second pause
   - Prevents API throttling
   - **Total time**: ~20-30 minutes

5. **Fallback Mechanism**: If AI fails, uses template answer

## How to Run

### Step 1: Generate 1000 Questions

```bash
cd c:\MF root folder\mutual-funds-backend
npx ts-node src/scripts/generate-1000-questions.ts
```

This will:

- Process all 1000 questions through Gemini AI
- Generate `knowledge-base-1000-generated.ts`
- Show progress with category breakdown

### Step 2: Update Service to Use New File

Edit `src/services/knowledge-base.service.ts`:

```typescript
// Change import from:
import { knowledgeBase } from '../data/knowledge-base';

// To:
import { knowledgeBase } from '../data/knowledge-base-1000-generated';
```

### Step 3: Re-seed MongoDB

```bash
npx ts-node src/scripts/seed-knowledge-base.ts
```

This will:

- Clear old 100 questions
- Seed new 1000 questions
- Recreate text search index
- Show category breakdown

### Step 4: Restart Backend

```bash
cd c:\MF root folder
.\start-dev.ps1
```

## Expected Output

After generation:

```
✅ Successfully generated 1000 knowledge base entries!
📊 Breakdown:
   Mutual Funds: 300 questions
   Stocks: 200 questions
   Commodities: 150 questions
   Debt Funds: 150 questions
   Calculations: 200 questions
```

After seeding:

```
✅ Successfully seeded 1000 knowledge base entries!
📖 Sample entries from each category...
📊 Entries by category:
   Mutual Funds: 300 questions
   Stocks: 200 questions
   Commodities: 150 questions
   Debt Funds: 150 questions
   Calculations: 200 questions
```

## Quality Assurance

### AI Prompt Engineering:

- Clear instructions for Indian context
- Word limits to keep answers concise
- JSON format for easy parsing
- Practical, beginner-friendly language

### Validation:

- Keywords extracted from question
- Level determined by question type
- Formula detection for calculation queries
- Fallback for failed generations

### Manual Review:

After generation, review sample questions from each category to ensure quality.

## File Structure

```
mutual-funds-backend/
├── src/
│   ├── data/
│   │   ├── knowledge-base.ts           (Original 100)
│   │   ├── knowledge-base-1000.ts      (Manual template)
│   │   └── knowledge-base-1000-generated.ts  (AI generated)
│   ├── scripts/
│   │   ├── generate-1000-questions.ts  (Generator script)
│   │   └── seed-knowledge-base.ts      (Seeding script)
│   └── services/
│       └── knowledge-base.service.ts   (Update import here)
```

## Benefits

### For Users:

- ✅ 10x more questions answered
- ✅ Covers all investment topics
- ✅ Faster chatbot responses
- ✅ Better search results
- ✅ Comprehensive learning resource

### For System:

- ✅ Reduces Gemini AI API calls (saves costs)
- ✅ Faster response time (DB vs API)
- ✅ Works offline after seeding
- ✅ Consistent answer quality
- ✅ Easy to update and maintain

## Maintenance

### Adding New Questions:

1. Add question to `questionsToGenerate` object in script
2. Run generator for new questions only
3. Merge with existing knowledge base
4. Re-seed MongoDB

### Updating Existing Answers:

1. Edit `knowledge-base-1000-generated.ts` directly
2. Or regenerate specific questions
3. Re-seed MongoDB

### Monitoring:

- Check MongoDB `knowledge_base` collection count
- Monitor chatbot match rate
- Track Gemini AI fallback rate
- Review user feedback on answers

## Next Steps

1. **Run Generator** (20-30 minutes)
2. **Review Sample Outputs** (10 minutes)
3. **Seed to MongoDB** (1 minute)
4. **Test Chatbot** (5 minutes)
5. **Monitor Performance** (ongoing)

## Troubleshooting

### If Generation Fails:

- Check Gemini API key in `.env`
- Verify API quota/limits
- Run in smaller batches (modify script)
- Use existing manual template

### If Seeding Fails:

- Check MongoDB connection
- Verify collection name
- Check JSON structure
- Review console errors

### If Chatbot Doesn't Match:

- Verify text search index created
- Check keyword extraction
- Review similarity threshold (0.4)
- Monitor logs for match scores

## Performance Metrics

### Before (100 questions):

- Match rate: ~30-40%
- Gemini API calls: 60-70% of queries
- Average response time: 2-3 seconds

### After (1000 questions - Expected):

- Match rate: ~70-80%
- Gemini API calls: 20-30% of queries
- Average response time: 0.5-1 second
- Monthly API cost: 70% reduction

## Support

Questions or issues?

1. Check generation logs
2. Review MongoDB connection
3. Test with sample questions
4. Monitor API responses

---

**Status**: Ready to generate 1000 questions
**Estimated Time**: 20-30 minutes
**Quality**: AI-generated with manual review recommended
