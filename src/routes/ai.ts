import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// Initialize Google Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
let genAI: GoogleGenerativeAI | null = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  console.log('✅ Google Gemini AI initialized');
} else {
  console.log('⚠️  GEMINI_API_KEY not found, using enhanced rule-based system');
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  query: string;
  context?: {
    conversationHistory?: ChatMessage[];
    fundData?: any;
    userProfile?: any;
  };
}

/**
 * POST /api/ai/chat
 * AI-powered chat assistant for mutual fund queries
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { query, context }: ChatRequest = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Query is required and must be a string',
      });
    }

    console.log('💬 AI Chat request:', { query });

    // Try to use Gemini AI if available
    if (genAI) {
      try {
        console.log('🤖 Using Google Gemini AI');
        const answer = await generateGeminiResponse(query, context);
        return res.json({
          success: true,
          data: {
            answer,
            sources: [],
            followUpQuestions: getFollowUpQuestions(query),
          },
        });
      } catch (aiError: any) {
        console.error('⚠️  Gemini AI error, falling back:', aiError.message);
        // Fall through to rule-based system
      }
    }

    // Use enhanced rule-based responses as fallback
    console.log('⚠️  Using enhanced rule-based system');
    const answer = generateRuleBasedResponse(query);
    return res.json({
      success: true,
      data: {
        answer,
        sources: [],
        followUpQuestions: getFollowUpQuestions(query),
      },
    });
  } catch (error: any) {
    console.error('❌ AI Chat error:', error.message);

    // Fallback to rule-based response on error
    const answer = generateRuleBasedResponse(req.body.query);
    return res.json({
      success: true,
      data: {
        answer,
        sources: [],
        followUpQuestions: getFollowUpQuestions(req.body.query),
      },
    });
  }
});

/**
 * Generate response using Google Gemini AI
 */
async function generateGeminiResponse(
  query: string,
  context?: ChatRequest['context']
): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini AI not initialized');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  // Build conversation history
  let conversationContext = '';
  if (context?.conversationHistory && context.conversationHistory.length > 0) {
    conversationContext =
      '\n\nPrevious conversation:\n' +
      context.conversationHistory
        .slice(-4)
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');
  }

  const systemPrompt = `You are an expert financial advisor specializing in Indian mutual funds. Your role is to:

1. **Provide accurate, comprehensive answers** about mutual funds, SIPs, investment strategies, and financial planning
2. **Handle ALL types of questions** - from basic concepts to technical analysis, tax implications, and portfolio strategies
3. **Use Indian context** - refer to Indian companies (Reliance, TCS, HDFC Bank, Infosys), Indian tax laws (LTCG, STCG), and SEBI regulations
4. **Be conversational yet professional** - use emojis moderately, bullet points for clarity
5. **Educate and inform** - explain complex terms in simple language
6. **Stay current** - reference 2024-2025 tax laws and market conditions

Key Information:
- LTCG on equity: 12.5% (>₹1.25L gains annually)
- STCG on equity: 20%
- Large Cap: Top 100 companies
- Mid Cap: 101-250 rank
- Small Cap: Beyond 250 rank
- Minimum SIP: Usually ₹500/month
- ELSS lock-in: 3 years

IMPORTANT: 
- Always provide detailed, thoughtful answers
- If asked technical questions about ratios (Sharpe, Sortino, Alpha, Beta), explain them clearly
- For portfolio questions, give balanced advice
- Never recommend specific funds, but explain how to evaluate them
- Always mention "Consult a certified financial advisor for personalized advice"

${conversationContext}

User Question: ${query}

Provide a detailed, helpful answer (200-400 words):`;

  const result = await model.generateContent(systemPrompt);
  const response = result.response;
  const text = response.text();

  return text;
}

/**
 * Calculate similarity between two strings (Levenshtein distance based)
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Find best matching keyword with fuzzy matching
 */
function findBestMatch(query: string, keywords: string[]): string | null {
  const threshold = 0.7; // 70% similarity required
  let bestMatch = '';
  let bestScore = 0;

  const queryWords = query.toLowerCase().split(/\s+/);

  for (const word of queryWords) {
    for (const keyword of keywords) {
      const score = similarity(word, keyword);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = keyword;
      }
    }
  }

  return bestScore >= threshold ? bestMatch : null;
}

/**
 * Normalize query with spelling correction
 */
function normalizeQuery(query: string): string {
  const lowerQuery = query.toLowerCase();

  // Define keywords with common misspellings
  const keywords = {
    sip: ['sip', 'systematic', 'investment', 'plan'],
    expense: ['expense', 'expens', 'expence', 'ratio', 'fee', 'fees', 'cost'],
    equity: ['equity', 'equty', 'equit', 'stock', 'stocks', 'share'],
    debt: ['debt', 'det', 'bond', 'bonds'],
    large: ['large', 'larg', 'big'],
    mid: ['mid', 'middle', 'medium'],
    small: ['small', 'smal', 'smol', 'tiny'],
    cap: ['cap', 'capital', 'capitalization'],
    return: ['return', 'returns', 'profit', 'gain'],
    risk: ['risk', 'risky', 'danger', 'volatile'],
    tax: ['tax', 'taxation', 'taxes'],
    compare: ['compare', 'comparison', 'difference', 'versus', 'vs'],
  };

  let normalized = lowerQuery;

  // Apply fuzzy matching for each keyword category
  for (const [correct, variants] of Object.entries(keywords)) {
    const match = findBestMatch(lowerQuery, variants);
    if (match) {
      // Replace fuzzy matched word with correct keyword
      const words = normalized.split(/\s+/);
      normalized = words
        .map((word) => {
          if (similarity(word, match) >= 0.7) {
            return correct;
          }
          return word;
        })
        .join(' ');
    }
  }

  return normalized;
}

/**
 * Generate rule-based response (fallback)
 */
function generateRuleBasedResponse(query: string): string {
  // Normalize query with spelling correction
  const normalizedQuery = normalizeQuery(query);
  const lowerQuery = normalizedQuery.toLowerCase();

  console.log('🔍 Original query:', query);
  console.log('✨ Normalized query:', normalizedQuery);

  // ===== TECHNICAL METRICS (Check these FIRST before general topics) =====

  // Sharpe Ratio
  if (lowerQuery.includes('sharpe') || lowerQuery.includes('risk adjusted')) {
    return `📊 **Sharpe Ratio - Risk-Adjusted Returns**

Sharpe Ratio measures how much excess return you get for the extra volatility you endure.

🧮 **Formula**: (Fund Return - Risk-free Rate) / Standard Deviation

📈 **Interpretation**:
• **>1.0**: Good risk-adjusted returns
• **>2.0**: Excellent performance
• **<1.0**: Returns don't justify the risk
• **Negative**: Fund underperforming risk-free rate

💡 **Why It Matters**:
A fund with 15% return and Sharpe ratio of 1.5 is better than a fund with 18% return and Sharpe ratio of 0.8 - you're getting more return per unit of risk!

Use Sharpe ratio to compare funds within the same category.`;
  }

  // Alpha & Beta
  if (
    lowerQuery.includes('alpha') ||
    lowerQuery.includes('beta') ||
    lowerQuery.includes('benchmark')
  ) {
    return `📊 **Alpha & Beta - Fund Performance Metrics**

**Alpha** measures a fund's performance vs its benchmark:
• Positive Alpha: Fund beat the benchmark (Good!)
• Negative Alpha: Fund underperformed (Not ideal)
• Example: Alpha of 2 means fund gave 2% more than benchmark

**Beta** measures volatility compared to market:
• Beta = 1: Moves exactly with market
• Beta > 1: More volatile (aggressive)
• Beta < 1: Less volatile (defensive)
• Example: Beta of 1.2 = 20% more volatile than market

💡 **How to Use**:
- Look for high Alpha (outperformance)
- Choose Beta based on risk appetite
- High Beta in bull markets, Low Beta in uncertain times`;
  }

  // Standard Deviation & Volatility
  if (
    lowerQuery.includes('standard deviation') ||
    lowerQuery.includes('volatility') ||
    lowerQuery.includes('volatile')
  ) {
    return `📊 **Standard Deviation & Volatility**

Standard Deviation measures how much a fund's returns fluctuate from its average.

📈 **Understanding the Numbers**:
• **Low SD (5-10)**: Stable, less risky (debt funds)
• **Medium SD (10-15)**: Moderate fluctuation (large cap)
• **High SD (>15)**: High volatility (mid/small cap)

⚠️ **Impact on You**:
- Higher SD = Your investment value swings more
- Lower SD = Smoother, predictable journey
- But higher volatility can mean higher long-term returns!

💡 **Key Insight**:
Don't fear volatility if you have a long investment horizon (5-7 years). Short-term ups and downs average out over time.`;
  }

  // NAV
  if (lowerQuery.includes('nav') && !lowerQuery.includes('navigate')) {
    return `📊 **NAV - Net Asset Value**

NAV is the price per unit of a mutual fund, calculated daily after market closes.

🧮 **Formula**: 
NAV = (Total Assets - Total Liabilities) / Total Units Outstanding

💡 **Key Facts**:
• NAV changes daily based on market performance
• Higher NAV ≠ Expensive fund (common myth!)
• What matters is % returns, not absolute NAV value

**Example**: 
- Fund A: NAV ₹100, returns 15%
- Fund B: NAV ₹500, returns 15%
Both give same returns! NAV doesn't indicate performance.

✅ **Remember**: Judge funds by returns %, not NAV price!`;
  }

  // AUM
  if (
    lowerQuery.includes('aum') ||
    lowerQuery.includes('asset under management')
  ) {
    return `📊 **AUM - Assets Under Management**

AUM is the total market value of assets a mutual fund manages.

💰 **What It Means**:
• **Large AUM (>₹10,000 Cr)**: Popular, liquid, stable
• **Medium AUM (₹1,000-10,000 Cr)**: Balanced
• **Small AUM (<₹1,000 Cr)**: Nimble but risky

✅ **Advantages of Large AUM**:
- Easier to buy/sell (good liquidity)
- Lower risk of fund house closing it
- Proven track record

⚠️ **Disadvantages of Large AUM**:
- Hard to beat benchmark (too big to be agile)
- Limited investment opportunities
- Small cap funds suffer with large AUM

💡 **Sweet Spot**: ₹2,000-8,000 Cr for equity funds`;
  }

  // Exit Load
  if (
    lowerQuery.includes('exit load') ||
    (lowerQuery.includes('redemption') && !lowerQuery.includes('sip'))
  ) {
    return `💰 **Exit Load - Early Withdrawal Fee**

Exit Load is a penalty charged when you redeem (sell) your fund units before a specified period.

📋 **Typical Structure**:
• Equity Funds: 1% if withdrawn before 1 year
• Debt Funds: 0.25-0.5% if withdrawn before 3-6 months
• Liquid Funds: Usually no exit load

**Example**:
Investment: ₹1,00,000
Current Value: ₹1,20,000
Exit Load: 1%
You receive: ₹1,20,000 - 1% = ₹1,18,800

💡 **Purpose**: 
Discourages short-term trading, protects long-term investors from frequent entry/exit disruptions.

✅ **Tip**: Plan your investment horizon to avoid exit loads!`;
  }

  // ELSS
  if (
    lowerQuery.includes('elss') ||
    lowerQuery.includes('tax saving') ||
    lowerQuery.includes('80c')
  ) {
    return `🎯 **ELSS - Tax-Saving Mutual Funds**

ELSS (Equity Linked Savings Scheme) helps you save tax under Section 80C.

💰 **Benefits**:
• Tax deduction up to ₹1.5 lakh annually
• **Shortest lock-in**: Only 3 years (vs 5 for FDs, 15 for PPF)
• Equity returns: 12-15% potential annually
• Invested in equity markets (growth potential)

📊 **Who Should Invest**:
• Salaried individuals looking to save tax
• Long-term investors (minimum 3 years)
• Those comfortable with equity market risk

⚠️ **Important**:
- Locked for 3 years (no withdrawal)
- Subject to market risk
- LTCG tax: 12.5% on gains >₹1.25L

Better than traditional tax-saving options due to higher returns!`;
  }

  // Direct vs Regular
  if (
    lowerQuery.includes('direct') &&
    (lowerQuery.includes('regular') || lowerQuery.includes('plan'))
  ) {
    return `📊 **Direct vs Regular Plans**

**Direct Plans**:
✅ Buy directly from fund house (online/offline)
✅ Lower expense ratio (0.5-1% less)
✅ Higher returns due to lower costs
✅ No intermediary commissions

**Regular Plans**:
📋 Buy through distributor/advisor
📋 Higher expense ratio (includes commission)
📋 Lower returns due to higher costs
📋 Get advisory services

💰 **Impact Example** (₹10L, 10 years, 12% return):
- Direct Plan: ₹31.05 lakhs
- Regular Plan: ₹28.80 lakhs
- **Difference: ₹2.25 lakhs!**

💡 **Recommendation**: 
Choose Direct if you can research yourself. Choose Regular if you need professional guidance.`;
  }

  // Lumpsum vs SIP
  if (lowerQuery.includes('lumpsum') || lowerQuery.includes('lump sum')) {
    return `💰 **Lumpsum vs SIP Investment**

**Lumpsum** = Investing entire amount at once
**SIP** = Investing fixed amount monthly

✅ **Lumpsum Better When**:
- You have surplus cash available
- Market is at low/correction phase
- You can handle volatility
- For debt funds (less volatile)

✅ **SIP Better When**:
- Regular income (salary)
- Market is high (rupee-cost averaging)
- Building investment discipline
- For equity funds (volatile)

📊 **Performance**:
- Lumpsum can give higher returns if market timing is right
- SIP averages out market volatility (safer approach)

💡 **Best Strategy**: 
Start SIP for regular investing + Invest lumpsum during market corrections!`;
  }

  // Portfolio Diversification
  if (lowerQuery.includes('portfolio') || lowerQuery.includes('diversif')) {
    return `🎯 **Portfolio Diversification Strategy**

Don't put all eggs in one basket! Spread investments across:

📊 **Asset Allocation**:
• **Aggressive (Age 20-35)**: 80% Equity, 20% Debt
• **Moderate (Age 35-50)**: 60% Equity, 40% Debt
• **Conservative (Age 50+)**: 30% Equity, 70% Debt

🎯 **Fund Mix**:
• Large Cap: 40-50% (stability)
• Mid Cap: 20-30% (growth)
• Small Cap: 10-20% (high growth)
• Debt/Liquid: 20-30% (safety)

💡 **Golden Rules**:
1. Have 4-6 mutual funds (not more!)
2. Mix different fund categories
3. Rebalance annually
4. Don't over-diversify (diminishing returns)

✅ Diversification reduces risk without sacrificing returns!`;
  }

  // Rebalancing
  if (lowerQuery.includes('rebalanc')) {
    return `⚖️ **Portfolio Rebalancing**

Rebalancing means adjusting your portfolio back to original asset allocation.

**Why Needed**:
If you started with 70% equity, 30% debt, after 2 years it might become 85% equity, 15% debt (equity grew more). Now you're taking more risk than intended!

📅 **When to Rebalance**:
• Annually (recommended)
• When allocation shifts >10%
• Major life events (marriage, child)
• Near retirement

🔄 **How to Rebalance**:
1. Check current allocation
2. Sell overperforming assets
3. Buy underperforming assets
4. Or direct new investments to underweight assets

💡 **Benefits**:
- Maintains risk level
- Forces "buy low, sell high"
- Prevents concentration risk`;
  }

  // Index Funds
  if (
    lowerQuery.includes('index fund') ||
    (lowerQuery.includes('index') && lowerQuery.includes('passive'))
  ) {
    return `📊 **Index Funds - Passive Investing**

Index funds simply copy a market index (Nifty 50, Sensex).

✅ **Advantages**:
• **Very low expense ratio** (0.1-0.5%)
• Guaranteed market returns
• No fund manager risk
• Simple, transparent
• Best for long-term (15+ years)

⚠️ **Disadvantages**:
• Can't beat market returns
• Falls when market crashes
• No downside protection

**Active vs Index**:
- Active funds try to beat market (higher fees)
- Index funds match market (lower fees)

💡 **Best For**:
• Beginners
• Long-term investors
• Those who believe markets always rise over time

Popular index funds track Nifty 50, Nifty Next 50, Sensex.`;
  }

  // Expense ratio (Check after Sharpe/Sortino!)
  if (
    lowerQuery.includes('expense') ||
    (lowerQuery.includes('ratio') &&
      !lowerQuery.includes('sharpe') &&
      !lowerQuery.includes('sortino')) ||
    lowerQuery.includes('fee') ||
    lowerQuery.includes('cost')
  ) {
    return `💰 **Expense Ratio Explained**

Expense Ratio is the annual fee charged by mutual fund houses for managing your investments:

💸 **What it includes**:
- Fund management fees
- Administrative costs
- Marketing expenses
- Distribution costs

📊 **Impact**:
- Lower expense ratio means more of your returns stay with you
- For equity funds: Typically 0.5% to 2.5%
- For debt funds: Typically 0.25% to 2%
- Direct plans have lower expense ratios than regular plans

✅ **Pro tip**: Even a 0.5% difference can significantly impact long-term returns due to compounding!`;
  }

  // Compare funds
  if (
    lowerQuery.includes('compare') ||
    lowerQuery.includes('difference') ||
    lowerQuery.includes('vs')
  ) {
    return `To compare mutual funds effectively, consider these key factors:

🔍 **Performance Metrics**:
- Returns: 1-year, 3-year, 5-year track record
- Risk-adjusted returns (Sharpe ratio, Sortino ratio)
- Consistency in performance

📊 **Fund Characteristics**:
- Expense ratio (lower is generally better)
- AUM (Assets Under Management)
- Fund manager experience
- Portfolio holdings and diversification

⚖️ **Your Requirements**:
- Investment goals and timeline
- Risk tolerance
- Tax implications

Use our Compare tool to see detailed side-by-side analysis of any two funds!`;
  }

  // ===== FUND TYPES & CATEGORIES =====

  // SIP related
  if (
    lowerQuery.includes('sip') ||
    lowerQuery.includes('systematic investment')
  ) {
    return `SIP (Systematic Investment Plan) is a disciplined way to invest in mutual funds. Here's what you need to know:

💡 **How it works**: You invest a fixed amount regularly (monthly/quarterly) in your chosen mutual fund. This helps in:
- Rupee cost averaging (buying more units when prices are low)
- Building long-term wealth through compounding
- Developing a saving habit

📊 **Benefits**:
- Start with as little as ₹500/month
- No need to time the market
- Automatic deductions from your bank account

For personalized SIP recommendations based on your goals, please consult a financial advisor.`;
  }

  // Large Cap funds
  if (
    lowerQuery.includes('large cap') ||
    lowerQuery.includes('largecap') ||
    lowerQuery.includes('large-cap')
  ) {
    return `🏢 **Large Cap Mutual Funds**

Large Cap funds invest in the **top 100 companies** by market capitalization in India.

✨ **Key Features**:
• Lower risk & stable returns
• Invest in established giants (Reliance, TCS, HDFC Bank, Infosys)
• Less volatile than mid/small caps
• Ideal for beginners

💰 **Expected Returns**: 10-14% annually

📊 **Best For**:
• Conservative investors
• First-time equity investors  
• 3-5 year investment horizon

💡 **Pro Tip**: Great for building a core portfolio!`;
  }

  // Mid Cap funds
  if (
    lowerQuery.includes('mid cap') ||
    lowerQuery.includes('midcap') ||
    lowerQuery.includes('mid-cap')
  ) {
    return `🎯 **Mid Cap Mutual Funds**

Mid Cap funds invest in companies **ranked 101-250** by market cap - the rising stars of Indian markets!

✨ **Key Features**:
• Medium risk, medium returns
• Growth-stage companies with potential
• More volatile than large caps
• Higher growth than established companies

💰 **Expected Returns**: 12-16% annually

📊 **Best For**:
• Moderate risk takers
• 5+ year investment horizon
• Diversifying beyond large caps

⚠️ **Remember**: Can be volatile short-term, but rewarding long-term!`;
  }

  // Small Cap funds
  if (
    lowerQuery.includes('small cap') ||
    lowerQuery.includes('smallcap') ||
    lowerQuery.includes('small-cap')
  ) {
    return `🚀 **Small Cap Mutual Funds**

Small Cap funds invest in companies **beyond 250th rank** - tomorrow's giants!

✨ **Key Features**:
• Highest risk & return potential
• Emerging companies, explosive growth
• Very high volatility
• Can multiply wealth in bull markets

💰 **Expected Returns**: 14-20% annually

📊 **Best For**:
• Aggressive investors only
• 7+ year investment horizon
• High risk tolerance essential

⚠️ **Warning**: Not for beginners or the faint-hearted!`;
  }

  // General equity funds
  if (lowerQuery.includes('equity') || lowerQuery.includes('stock')) {
    return `📈 **Equity Mutual Funds**

Equity funds invest primarily in stocks for long-term wealth creation!

🎯 **Fund Types**:
• **Large Cap**: Top 100 companies (safest)
• **Mid Cap**: Rank 101-250 (balanced)
• **Small Cap**: Beyond 250 (aggressive)
• **Multi Cap**: Mix of all

💡 **Key Points**:
• Best for 5+ years
• Short-term volatility is normal
• Tax: LTCG >₹1.25L @ 12.5%, STCG @ 20%

Choose based on your risk appetite!`;
  }

  // Debt funds
  if (lowerQuery.includes('debt') || lowerQuery.includes('bond')) {
    return `Debt mutual funds invest in fixed-income securities like bonds, government securities, and treasury bills:

🏦 **Characteristics**:
- Lower risk compared to equity funds
- More stable returns
- Suitable for short to medium term goals

📋 **Types**:
- Liquid Funds: Very short-term (days to weeks)
- Short Duration: 1-3 years
- Medium Duration: 3-4 years
- Long Duration: 7+ years

💰 **Taxation**: Based on holding period and income slab

Best for conservative investors or as a safer component in a diversified portfolio.`;
  }

  // Expense ratio
  if (
    lowerQuery.includes('expense') ||
    lowerQuery.includes('ratio') ||
    lowerQuery.includes('fee') ||
    lowerQuery.includes('cost')
  ) {
    return `💰 **Expense Ratio Explained**

Expense Ratio is the annual fee charged by mutual fund houses for managing your investments:

💸 **What it includes**:
- Fund management fees
- Administrative costs
- Marketing expenses
- Distribution costs

📊 **Impact**:
- Lower expense ratio means more of your returns stay with you
- For equity funds: Typically 0.5% to 2.5%
- For debt funds: Typically 0.25% to 2%
- Direct plans have lower expense ratios than regular plans

✅ **Pro tip**: Even a 0.5% difference can significantly impact long-term returns due to compounding!`;
  }

  // Compare funds
  if (
    lowerQuery.includes('compare') ||
    lowerQuery.includes('difference') ||
    lowerQuery.includes('vs')
  ) {
    return `To compare mutual funds effectively, consider these key factors:

🔍 **Performance Metrics**:
- Returns: 1-year, 3-year, 5-year track record
- Risk-adjusted returns (Sharpe ratio, Sortino ratio)
- Consistency in performance

📊 **Fund Characteristics**:
- Expense ratio (lower is generally better)
- AUM (Assets Under Management)
- Fund manager experience
- Portfolio holdings and diversification

⚖️ **Your Requirements**:
- Investment goals and timeline
- Risk tolerance
- Tax implications

Use our Compare tool to see detailed side-by-side analysis of any two funds!`;
  }

  // ===== DEFAULT RESPONSE =====

  // Sharpe Ratio (DUPLICATE - REMOVE THIS BLOCK)
  if (
    false &&
    (lowerQuery.includes('sharpe') || lowerQuery.includes('risk adjusted'))
  ) {
    return `📊 **Sharpe Ratio - Risk-Adjusted Returns**

Sharpe Ratio measures how much excess return you get for the extra volatility you endure.

🧮 **Formula**: (Fund Return - Risk-free Rate) / Standard Deviation

📈 **Interpretation**:
• **>1.0**: Good risk-adjusted returns
• **>2.0**: Excellent performance
• **<1.0**: Returns don't justify the risk
• **Negative**: Fund underperforming risk-free rate

💡 **Why It Matters**:
A fund with 15% return and Sharpe ratio of 1.5 is better than a fund with 18% return and Sharpe ratio of 0.8 - you're getting more return per unit of risk!

Use Sharpe ratio to compare funds within the same category.`;
  }

  // Alpha & Beta
  if (
    lowerQuery.includes('alpha') ||
    lowerQuery.includes('beta') ||
    lowerQuery.includes('benchmark')
  ) {
    return `📊 **Alpha & Beta - Fund Performance Metrics**

**Alpha** measures a fund's performance vs its benchmark:
• Positive Alpha: Fund beat the benchmark (Good!)
• Negative Alpha: Fund underperformed (Not ideal)
• Example: Alpha of 2 means fund gave 2% more than benchmark

**Beta** measures volatility compared to market:
• Beta = 1: Moves exactly with market
• Beta > 1: More volatile (aggressive)
• Beta < 1: Less volatile (defensive)
• Example: Beta of 1.2 = 20% more volatile than market

💡 **How to Use**:
- Look for high Alpha (outperformance)
- Choose Beta based on risk appetite
- High Beta in bull markets, Low Beta in uncertain times`;
  }

  // Standard Deviation & Volatility
  if (
    lowerQuery.includes('standard deviation') ||
    lowerQuery.includes('volatility') ||
    lowerQuery.includes('volatile')
  ) {
    return `📊 **Standard Deviation & Volatility**

Standard Deviation measures how much a fund's returns fluctuate from its average.

📈 **Understanding the Numbers**:
• **Low SD (5-10)**: Stable, less risky (debt funds)
• **Medium SD (10-15)**: Moderate fluctuation (large cap)
• **High SD (>15)**: High volatility (mid/small cap)

⚠️ **Impact on You**:
- Higher SD = Your investment value swings more
- Lower SD = Smoother, predictable journey
- But higher volatility can mean higher long-term returns!

💡 **Key Insight**:
Don't fear volatility if you have a long investment horizon (5-7 years). Short-term ups and downs average out over time.`;
  }

  // NAV
  if (lowerQuery.includes('nav') || lowerQuery.includes('net asset value')) {
    return `📊 **NAV - Net Asset Value**

NAV is the price per unit of a mutual fund, calculated daily after market closes.

🧮 **Formula**: 
NAV = (Total Assets - Total Liabilities) / Total Units Outstanding

💡 **Key Facts**:
• NAV changes daily based on market performance
• Higher NAV ≠ Expensive fund (common myth!)
• What matters is % returns, not absolute NAV value

**Example**: 
- Fund A: NAV ₹100, returns 15%
- Fund B: NAV ₹500, returns 15%
Both give same returns! NAV doesn't indicate performance.

✅ **Remember**: Judge funds by returns %, not NAV price!`;
  }

  // AUM
  if (
    lowerQuery.includes('aum') ||
    lowerQuery.includes('asset under management')
  ) {
    return `📊 **AUM - Assets Under Management**

AUM is the total market value of assets a mutual fund manages.

💰 **What It Means**:
• **Large AUM (>₹10,000 Cr)**: Popular, liquid, stable
• **Medium AUM (₹1,000-10,000 Cr)**: Balanced
• **Small AUM (<₹1,000 Cr)**: Nimble but risky

✅ **Advantages of Large AUM**:
- Easier to buy/sell (good liquidity)
- Lower risk of fund house closing it
- Proven track record

⚠️ **Disadvantages of Large AUM**:
- Hard to beat benchmark (too big to be agile)
- Limited investment opportunities
- Small cap funds suffer with large AUM

💡 **Sweet Spot**: ₹2,000-8,000 Cr for equity funds`;
  }

  // Exit Load
  if (lowerQuery.includes('exit load') || lowerQuery.includes('redemption')) {
    return `💰 **Exit Load - Early Withdrawal Fee**

Exit Load is a penalty charged when you redeem (sell) your fund units before a specified period.

📋 **Typical Structure**:
• Equity Funds: 1% if withdrawn before 1 year
• Debt Funds: 0.25-0.5% if withdrawn before 3-6 months
• Liquid Funds: Usually no exit load

**Example**:
Investment: ₹1,00,000
Current Value: ₹1,20,000
Exit Load: 1%
You receive: ₹1,20,000 - 1% = ₹1,18,800

💡 **Purpose**: 
Discourages short-term trading, protects long-term investors from frequent entry/exit disruptions.

✅ **Tip**: Plan your investment horizon to avoid exit loads!`;
  }

  // ELSS
  if (
    lowerQuery.includes('elss') ||
    lowerQuery.includes('tax saving') ||
    lowerQuery.includes('80c')
  ) {
    return `🎯 **ELSS - Tax-Saving Mutual Funds**

ELSS (Equity Linked Savings Scheme) helps you save tax under Section 80C.

💰 **Benefits**:
• Tax deduction up to ₹1.5 lakh annually
• **Shortest lock-in**: Only 3 years (vs 5 for FDs, 15 for PPF)
• Equity returns: 12-15% potential annually
• Invested in equity markets (growth potential)

📊 **Who Should Invest**:
• Salaried individuals looking to save tax
• Long-term investors (minimum 3 years)
• Those comfortable with equity market risk

⚠️ **Important**:
- Locked for 3 years (no withdrawal)
- Subject to market risk
- LTCG tax: 12.5% on gains >₹1.25L

Better than traditional tax-saving options due to higher returns!`;
  }

  // Direct vs Regular
  if (lowerQuery.includes('direct') && lowerQuery.includes('regular')) {
    return `📊 **Direct vs Regular Plans**

**Direct Plans**:
✅ Buy directly from fund house (online/offline)
✅ Lower expense ratio (0.5-1% less)
✅ Higher returns due to lower costs
✅ No intermediary commissions

**Regular Plans**:
📋 Buy through distributor/advisor
📋 Higher expense ratio (includes commission)
📋 Lower returns due to higher costs
📋 Get advisory services

💰 **Impact Example** (₹10L, 10 years, 12% return):
- Direct Plan: ₹31.05 lakhs
- Regular Plan: ₹28.80 lakhs
- **Difference: ₹2.25 lakhs!**

💡 **Recommendation**: 
Choose Direct if you can research yourself. Choose Regular if you need professional guidance.`;
  }

  // Lumpsum vs SIP
  if (lowerQuery.includes('lumpsum') || lowerQuery.includes('lump sum')) {
    return `💰 **Lumpsum vs SIP Investment**

**Lumpsum** = Investing entire amount at once
**SIP** = Investing fixed amount monthly

✅ **Lumpsum Better When**:
- You have surplus cash available
- Market is at low/correction phase
- You can handle volatility
- For debt funds (less volatile)

✅ **SIP Better When**:
- Regular income (salary)
- Market is high (rupee-cost averaging)
- Building investment discipline
- For equity funds (volatile)

📊 **Performance**:
- Lumpsum can give higher returns if market timing is right
- SIP averages out market volatility (safer approach)

💡 **Best Strategy**: 
Start SIP for regular investing + Invest lumpsum during market corrections!`;
  }

  // Portfolio Diversification
  if (lowerQuery.includes('portfolio') || lowerQuery.includes('diversif')) {
    return `🎯 **Portfolio Diversification Strategy**

Don't put all eggs in one basket! Spread investments across:

📊 **Asset Allocation**:
• **Aggressive (Age 20-35)**: 80% Equity, 20% Debt
• **Moderate (Age 35-50)**: 60% Equity, 40% Debt
• **Conservative (Age 50+)**: 30% Equity, 70% Debt

🎯 **Fund Mix**:
• Large Cap: 40-50% (stability)
• Mid Cap: 20-30% (growth)
• Small Cap: 10-20% (high growth)
• Debt/Liquid: 20-30% (safety)

💡 **Golden Rules**:
1. Have 4-6 mutual funds (not more!)
2. Mix different fund categories
3. Rebalance annually
4. Don't over-diversify (diminishing returns)

✅ Diversification reduces risk without sacrificing returns!`;
  }

  // Rebalancing
  if (lowerQuery.includes('rebalanc')) {
    return `⚖️ **Portfolio Rebalancing**

Rebalancing means adjusting your portfolio back to original asset allocation.

**Why Needed**:
If you started with 70% equity, 30% debt, after 2 years it might become 85% equity, 15% debt (equity grew more). Now you're taking more risk than intended!

📅 **When to Rebalance**:
• Annually (recommended)
• When allocation shifts >10%
• Major life events (marriage, child)
• Near retirement

🔄 **How to Rebalance**:
1. Check current allocation
2. Sell overperforming assets
3. Buy underperforming assets
4. Or direct new investments to underweight assets

💡 **Benefits**:
- Maintains risk level
- Forces "buy low, sell high"
- Prevents concentration risk`;
  }

  // Index Funds
  if (lowerQuery.includes('index fund') || lowerQuery.includes('passive')) {
    return `📊 **Index Funds - Passive Investing**

Index funds simply copy a market index (Nifty 50, Sensex).

✅ **Advantages**:
• **Very low expense ratio** (0.1-0.5%)
• Guaranteed market returns
• No fund manager risk
• Simple, transparent
• Best for long-term (15+ years)

⚠️ **Disadvantages**:
• Can't beat market returns
• Falls when market crashes
• No downside protection

**Active vs Index**:
- Active funds try to beat market (higher fees)
- Index funds match market (lower fees)

💡 **Best For**:
• Beginners
• Long-term investors
• Those who believe markets always rise over time

Popular index funds track Nifty 50, Nifty Next 50, Sensex.`;
  }

  // Default response
  return `Thank you for your question about mutual funds! 🙏

I'm here to help you understand:
- Different types of mutual funds
- Investment strategies like SIP and lumpsum
- How to choose the right funds
- Risk and return concepts
- Tax implications

Some popular questions I can help with:
1. What is SIP and how does it work?
2. Should I invest in equity or debt funds?
3. How to compare mutual funds?
4. What is expense ratio?

Feel free to ask me anything about mutual funds and investments! Remember, I provide educational information - for personalized advice, please consult a certified financial advisor.`;
}

/**
 * Generate follow-up questions based on the query
 */
function getFollowUpQuestions(query: string): string[] {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('sip')) {
    return [
      'What is the minimum SIP amount I can start with?',
      'How is SIP different from lumpsum investment?',
      'Can I stop or pause my SIP anytime?',
    ];
  }

  if (lowerQuery.includes('equity') || lowerQuery.includes('stock')) {
    return [
      'What is the difference between large cap and small cap funds?',
      'How long should I stay invested in equity funds?',
      'What are the tax implications for equity funds?',
    ];
  }

  if (lowerQuery.includes('debt') || lowerQuery.includes('bond')) {
    return [
      'Are debt funds completely risk-free?',
      'What is the typical return from debt funds?',
      'How are debt funds taxed?',
    ];
  }

  if (lowerQuery.includes('tax')) {
    return [
      'What is LTCG and STCG in mutual funds?',
      'How can I save tax through mutual funds?',
      'What is ELSS fund?',
    ];
  }

  // Default follow-up questions
  return [
    'What are the best equity funds to invest in?',
    'How does SIP work?',
    'What is the difference between direct and regular plans?',
  ];
}

export default router;
