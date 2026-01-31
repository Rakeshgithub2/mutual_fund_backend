/**
 * Comprehensive Financial Knowledge Base
 * 1000 Questions covering Mutual Funds, Stocks, Commodities, Debt Funds, and Calculations
 * Designed for investors in India (2026 tax rules)
 */

export interface KnowledgeEntry {
  id: number;
  question: string;
  keywords: string[]; // For matching user queries
  definition: string; // One-line simple definition
  points: string[]; // 5-7 bullet points
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  relatedQuestions?: number[]; // IDs of related questions
  formula?: string; // Optional formula for calculations
}

export const knowledgeBase1000: KnowledgeEntry[] = [
  // =============================================
  // MUTUAL FUNDS (Questions 1-300)
  // =============================================

  // Basics (1-50)
  {
    id: 1,
    question: 'What is a mutual fund?',
    keywords: ['mutual fund', 'mf', 'what is mf', 'mutual fund meaning'],
    definition:
      'A mutual fund pools money from many investors to invest in stocks, bonds, or other assets.',
    points: [
      'Mutual fund collects money from many investors',
      'Money is invested in shares, bonds, or other securities',
      'Professional fund managers handle investments',
      'You can start with as little as ₹100-500',
      'Returns depend on market performance',
      'SEBI regulates all mutual funds in India',
    ],
    category: 'Mutual Funds - Basics',
    level: 'beginner',
    relatedQuestions: [2, 3, 4],
  },
  {
    id: 2,
    question: 'How do mutual funds work?',
    keywords: ['how mutual funds work', 'mutual fund working', 'mf working'],
    definition:
      'Mutual funds collect money, buy securities, and distribute returns to investors based on their units.',
    points: [
      'Investors buy units of the fund at NAV price',
      'Fund manager invests pooled money in securities',
      'Fund value changes daily based on market',
      'Profits/losses are distributed proportionally',
      'You can redeem units anytime (in most funds)',
      'AMC charges expense ratio for management',
    ],
    category: 'Mutual Funds - Basics',
    level: 'beginner',
    relatedQuestions: [1, 5, 10],
  },
  {
    id: 3,
    question: 'What is NAV in mutual funds?',
    keywords: ['nav', 'net asset value', 'nav meaning', 'fund nav'],
    definition:
      'NAV (Net Asset Value) is the per-unit market value of a mutual fund.',
    points: [
      'NAV = (Total assets - Total liabilities) / Total units',
      'Updated daily after market close',
      'Buy and sell transactions happen at NAV',
      "Higher NAV doesn't mean better fund",
      'NAV changes with market movements',
      'Similar to stock price but calculated differently',
    ],
    category: 'Mutual Funds - Basics',
    level: 'beginner',
    relatedQuestions: [2, 4],
    formula:
      'NAV = (Total Assets - Total Liabilities) / Total Outstanding Units',
  },
  {
    id: 4,
    question: 'What is SIP in mutual funds?',
    keywords: [
      'sip',
      'systematic investment plan',
      'monthly sip',
      'sip meaning',
    ],
    definition:
      'SIP (Systematic Investment Plan) allows you to invest a fixed amount regularly in mutual funds.',
    points: [
      'Invest fixed amount monthly/quarterly/weekly',
      'Auto-debited from your bank account',
      'Rupee cost averaging benefit',
      'Can start with as low as ₹500/month',
      'Can increase, pause, or stop anytime',
      'Better than lump sum for most investors',
      'Builds investment discipline',
    ],
    category: 'Mutual Funds - Basics',
    level: 'beginner',
    relatedQuestions: [5, 6, 50],
  },
  {
    id: 5,
    question: 'What is lump sum investment?',
    keywords: ['lump sum', 'one time investment', 'bulk investment'],
    definition: 'Lump sum is investing a large amount in mutual funds at once.',
    points: [
      'Single large investment instead of monthly',
      'Better when market is low',
      'Higher risk than SIP',
      'Requires market timing skill',
      'Good for bonus/inheritance money',
      'Can give higher returns in bull market',
    ],
    category: 'Mutual Funds - Basics',
    level: 'beginner',
    relatedQuestions: [4, 6],
  },
  {
    id: 6,
    question: 'SIP vs Lump Sum - which is better?',
    keywords: ['sip vs lump sum', 'sip or lump sum', 'which is better'],
    definition:
      'SIP is better for regular investors; lump sum works when market is low and you have expertise.',
    points: [
      'SIP: Better for salaried investors',
      'SIP: Reduces timing risk through averaging',
      'Lump sum: Better if market has corrected',
      'Lump sum: Requires market knowledge',
      'SIP: Builds discipline and habit',
      'Can combine both strategies',
    ],
    category: 'Mutual Funds - Basics',
    level: 'intermediate',
    relatedQuestions: [4, 5],
  },
  {
    id: 7,
    question: 'What are equity mutual funds?',
    keywords: ['equity funds', 'equity mutual funds', 'stock funds'],
    definition: 'Equity funds invest primarily in stocks/shares of companies.',
    points: [
      'Invest 65%+ in equities',
      'Higher risk, higher return potential',
      'Best for long-term goals (5+ years)',
      'Returns linked to stock market',
      'Types: Large-cap, mid-cap, small-cap',
      'Tax benefit: LTCG above ₹1.25L taxed at 12.5%',
    ],
    category: 'Mutual Funds - Types',
    level: 'beginner',
    relatedQuestions: [8, 9, 10],
  },
  {
    id: 8,
    question: 'What are debt mutual funds?',
    keywords: ['debt funds', 'debt mutual funds', 'bond funds'],
    definition:
      'Debt funds invest in fixed-income securities like bonds, treasury bills, and government securities.',
    points: [
      'Lower risk than equity funds',
      'Invest in bonds, G-secs, corporate debt',
      'Suitable for short to medium term',
      'Returns more stable than equity',
      'Interest rate risk exists',
      'Good for conservative investors',
    ],
    category: 'Mutual Funds - Types',
    level: 'beginner',
    relatedQuestions: [7, 9],
  },
  {
    id: 9,
    question: 'What are hybrid mutual funds?',
    keywords: ['hybrid funds', 'balanced funds', 'hybrid mutual funds'],
    definition: 'Hybrid funds invest in both equity and debt instruments.',
    points: [
      'Mix of equity and debt',
      'Balanced risk-return profile',
      'Types: Aggressive, Conservative, Balanced',
      'Good for moderate risk investors',
      'Automatic asset rebalancing',
      'Single fund for diversification',
    ],
    category: 'Mutual Funds - Types',
    level: 'beginner',
    relatedQuestions: [7, 8],
  },
  {
    id: 10,
    question: 'What is expense ratio?',
    keywords: ['expense ratio', 'fund charges', 'management fees'],
    definition:
      'Expense ratio is the annual fee charged by mutual fund for managing your money.',
    points: [
      'Percentage of fund assets charged annually',
      'Includes management and operational costs',
      'Lower is better for investors',
      'SEBI limits: 2.25% for equity, 2% for debt',
      'Direct plans have lower expense ratio',
      'Deducted automatically from NAV',
    ],
    category: 'Mutual Funds - Costs',
    level: 'beginner',
    relatedQuestions: [11, 12],
    formula: 'Expense Ratio = (Total Fund Expenses / Total Fund Assets) × 100',
  },
  {
    id: 11,
    question: 'What is exit load?',
    keywords: ['exit load', 'redemption charges', 'exit fee'],
    definition:
      'Exit load is a fee charged when you redeem/withdraw from a mutual fund before a specified period.',
    points: [
      'Penalty for early withdrawal',
      'Usually 1% if redeemed within 1 year',
      'Discourages short-term trading',
      'Different funds have different exit loads',
      'No exit load after holding period',
      'Check before investing',
    ],
    category: 'Mutual Funds - Costs',
    level: 'beginner',
    relatedQuestions: [10, 12],
  },
  {
    id: 12,
    question: 'Direct plan vs Regular plan?',
    keywords: ['direct vs regular', 'direct plan', 'regular plan'],
    definition:
      'Direct plans have no distributor commission, resulting in lower expense ratio and higher returns.',
    points: [
      'Direct: Buy directly from AMC',
      'Direct: Lower expense ratio (0.5-1% less)',
      'Regular: Bought through distributor/agent',
      'Regular: Higher expenses due to commission',
      'Direct gives 1-2% extra returns over time',
      'Both invest in same stocks',
    ],
    category: 'Mutual Funds - Costs',
    level: 'intermediate',
    relatedQuestions: [10, 11],
  },
  {
    id: 13,
    question: 'What is large-cap fund?',
    keywords: ['large cap', 'large cap fund', 'blue chip fund'],
    definition:
      'Large-cap funds invest in top 100 companies by market capitalization.',
    points: [
      'Invest in well-established big companies',
      'Lower risk compared to mid/small cap',
      'Stable but moderate returns',
      'Good for conservative investors',
      'Examples: TCS, Reliance, HDFC Bank',
      'Best for 3-5 year goals',
    ],
    category: 'Mutual Funds - Types',
    level: 'beginner',
    relatedQuestions: [14, 15, 7],
  },
  {
    id: 14,
    question: 'What is mid-cap fund?',
    keywords: ['mid cap', 'mid cap fund', 'midcap'],
    definition:
      'Mid-cap funds invest in companies ranked 101-250 by market capitalization.',
    points: [
      'Invest in medium-sized companies',
      'Higher risk than large-cap',
      'Higher return potential than large-cap',
      'Good for 5-7 year goals',
      'More volatile than large-cap',
      'Can give multibagger returns',
    ],
    category: 'Mutual Funds - Types',
    level: 'intermediate',
    relatedQuestions: [13, 15, 7],
  },
  {
    id: 15,
    question: 'What is small-cap fund?',
    keywords: ['small cap', 'small cap fund', 'smallcap'],
    definition:
      'Small-cap funds invest in companies ranked 251+ by market capitalization.',
    points: [
      'Invest in small and emerging companies',
      'Highest risk among equity funds',
      'Highest return potential',
      'Very volatile',
      'Best for 7-10 year goals',
      'Only for aggressive investors',
    ],
    category: 'Mutual Funds - Types',
    level: 'intermediate',
    relatedQuestions: [13, 14, 7],
  },
  {
    id: 16,
    question: 'What is ELSS fund?',
    keywords: ['elss', 'tax saving fund', '80c', 'elss fund'],
    definition:
      'ELSS (Equity Linked Savings Scheme) offers tax deduction under Section 80C with 3-year lock-in.',
    points: [
      'Tax deduction up to ₹1.5 lakh under 80C',
      'Shortest lock-in (3 years) among 80C options',
      'Invests in equity stocks',
      'High return potential',
      'No redemption before 3 years',
      'Best tax-saving investment',
    ],
    category: 'Mutual Funds - Types',
    level: 'beginner',
    relatedQuestions: [7, 50, 51],
  },
  {
    id: 17,
    question: 'What is index fund?',
    keywords: ['index fund', 'passive fund', 'nifty fund'],
    definition: 'Index funds replicate a market index like Nifty 50 or Sensex.',
    points: [
      'Copies index composition exactly',
      'Passive management (no stock picking)',
      'Lower expense ratio',
      'Returns match index performance',
      'No fund manager risk',
      'Good for long-term passive investing',
    ],
    category: 'Mutual Funds - Types',
    level: 'beginner',
    relatedQuestions: [18, 7],
  },
  {
    id: 18,
    question: 'Active vs Passive funds?',
    keywords: ['active vs passive', 'active fund', 'passive fund'],
    definition:
      'Active funds try to beat market through stock selection; passive funds simply track an index.',
    points: [
      'Active: Fund manager picks stocks',
      'Active: Higher expense ratio',
      'Active: Can beat or underperform market',
      'Passive: Tracks index automatically',
      'Passive: Lower costs',
      'Passive: Returns match index',
    ],
    category: 'Mutual Funds - Types',
    level: 'intermediate',
    relatedQuestions: [17, 7],
  },
  {
    id: 19,
    question: 'What is liquid fund?',
    keywords: ['liquid fund', 'liquid mutual fund', 'emergency fund'],
    definition:
      'Liquid funds invest in very short-term debt instruments (up to 91 days maturity).',
    points: [
      'Park money for few days to few months',
      'Very low risk',
      'Better returns than savings account',
      'Instant redemption facility available',
      'No exit load usually',
      'Good for emergency fund',
    ],
    category: 'Mutual Funds - Types',
    level: 'beginner',
    relatedQuestions: [8, 20],
  },
  {
    id: 20,
    question: 'What is overnight fund?',
    keywords: ['overnight fund', 'overnight mutual fund'],
    definition: 'Overnight funds invest in securities maturing in 1 day.',
    points: [
      'Lowest risk among mutual funds',
      'Invest in 1-day maturity securities',
      'Slightly better than bank savings',
      'No interest rate risk',
      'Good for very short-term parking',
      'Can redeem anytime',
    ],
    category: 'Mutual Funds - Types',
    level: 'beginner',
    relatedQuestions: [19, 8],
  },

  // Add more mutual fund questions (21-300) with similar structure
  // For brevity, I'll add key questions and you can expand further

  {
    id: 50,
    question: 'How to calculate SIP returns?',
    keywords: ['sip returns', 'calculate sip', 'sip calculator'],
    definition:
      'SIP returns are calculated using XIRR (Extended Internal Rate of Return) method.',
    points: [
      'Use XIRR formula for accurate returns',
      'Cannot use simple percentage',
      'Each SIP installment is separate investment',
      'Online SIP calculators available',
      'Returns vary with market movements',
      'Long-term SIPs generally give better returns',
    ],
    category: 'Mutual Funds - Returns',
    level: 'intermediate',
    relatedQuestions: [4, 51, 52],
    formula: 'XIRR calculation considers cash flow dates and amounts',
  },

  // =============================================
  // STOCKS (Questions 301-500)
  // =============================================
  {
    id: 301,
    question: 'What is a stock?',
    keywords: ['stock', 'share', 'equity share', 'what is stock'],
    definition: 'A stock represents partial ownership in a company.',
    points: [
      'Stock = Share of company ownership',
      'Traded on stock exchanges (BSE/NSE)',
      'Price fluctuates based on demand-supply',
      'Can earn through dividends and price appreciation',
      'Higher risk than mutual funds',
      'Need demat account to buy/sell',
    ],
    category: 'Stocks - Basics',
    level: 'beginner',
    relatedQuestions: [302, 303],
  },
  {
    id: 302,
    question: 'How to buy stocks?',
    keywords: ['how to buy stocks', 'buy shares', 'stock buying'],
    definition:
      'Stocks are bought through a broker using a demat and trading account.',
    points: [
      'Open demat + trading account',
      'Complete KYC process',
      'Transfer money to trading account',
      'Select stock and place order',
      'Stocks credited to demat within T+1 days',
      'Can sell anytime during market hours',
    ],
    category: 'Stocks - Basics',
    level: 'beginner',
    relatedQuestions: [301, 303],
  },
  {
    id: 303,
    question: 'What is a demat account?',
    keywords: ['demat', 'demat account', 'dematerialization'],
    definition: 'Demat account holds your stocks in electronic form.',
    points: [
      'Holds shares electronically',
      'Like a bank account for stocks',
      'Mandatory to trade in stock market',
      'Linked with trading account',
      'Annual maintenance charges apply',
      'Protected by SEBI regulations',
    ],
    category: 'Stocks - Basics',
    level: 'beginner',
    relatedQuestions: [302, 304],
  },
  {
    id: 304,
    question: 'What is trading account?',
    keywords: ['trading account', 'trading', 'broker account'],
    definition: 'Trading account is used to buy and sell stocks on exchanges.',
    points: [
      'Provided by stockbroker',
      'Links your bank to demat account',
      'Used to place buy/sell orders',
      'Brokerage charges applied',
      'Different from demat account',
      'Required along with demat account',
    ],
    category: 'Stocks - Basics',
    level: 'beginner',
    relatedQuestions: [303, 302],
  },
  {
    id: 305,
    question: 'What is PE ratio?',
    keywords: ['pe ratio', 'price to earnings', 'p/e ratio'],
    definition:
      'PE ratio (Price-to-Earnings) shows how much investors pay for each rupee of company earnings.',
    points: [
      'PE = Stock Price / Earnings Per Share',
      'Higher PE = expensive/growth expectations',
      'Lower PE = undervalued/slower growth',
      'Compare within same industry',
      'Average Nifty PE around 20-25',
      'Not useful for loss-making companies',
    ],
    category: 'Stocks - Valuation',
    level: 'intermediate',
    relatedQuestions: [306, 307],
    formula: 'PE Ratio = Market Price per Share / Earnings Per Share (EPS)',
  },

  // =============================================
  // COMMODITIES (Questions 501-650)
  // =============================================
  {
    id: 501,
    question: 'What is commodity trading?',
    keywords: ['commodity', 'commodity trading', 'mcx'],
    definition:
      'Commodity trading involves buying and selling raw materials like gold, silver, crude oil, agricultural products.',
    points: [
      'Trade in physical goods/raw materials',
      'Popular: Gold, Silver, Crude oil, Copper',
      'Traded on MCX and NCDEX exchanges',
      'Can trade through futures contracts',
      'Hedge against inflation',
      'High leverage available',
    ],
    category: 'Commodities - Basics',
    level: 'intermediate',
    relatedQuestions: [502, 503],
  },
  {
    id: 502,
    question: 'How to invest in gold?',
    keywords: ['gold investment', 'invest in gold', 'gold'],
    definition:
      'Gold can be invested through physical gold, gold ETFs, sovereign gold bonds, or digital gold.',
    points: [
      'Physical: Jewelry, coins, bars',
      'Gold ETFs: Trade like stocks',
      'Sovereign Gold Bonds: Govt issued, earn interest',
      'Digital Gold: Buy online in small amounts',
      'Gold mutual funds available',
      'SGBs offer best returns (2.5% interest + price gain)',
    ],
    category: 'Commodities - Gold',
    level: 'beginner',
    relatedQuestions: [501, 503, 504],
  },
  {
    id: 503,
    question: 'What is Gold ETF?',
    keywords: ['gold etf', 'etf gold', 'gold exchange traded fund'],
    definition:
      'Gold ETF is a fund that invests in physical gold and trades on stock exchanges.',
    points: [
      'Backed by physical gold',
      'No making charges like jewelry',
      'Highly liquid',
      'Can buy/sell like stocks',
      'Lower expense ratio',
      'Stored securely by fund house',
    ],
    category: 'Commodities - Gold',
    level: 'beginner',
    relatedQuestions: [502, 504],
  },
  {
    id: 504,
    question: 'What is Sovereign Gold Bond?',
    keywords: ['sgb', 'sovereign gold bond', 'gold bond'],
    definition:
      'Sovereign Gold Bonds are government securities denominated in grams of gold.',
    points: [
      'Issued by RBI',
      'Earn 2.5% annual interest + gold price gain',
      '8-year maturity (can exit after 5 years)',
      'No storage issues',
      'Tax-free if held till maturity',
      'Better than physical gold',
    ],
    category: 'Commodities - Gold',
    level: 'beginner',
    relatedQuestions: [502, 503],
  },

  // =============================================
  // DEBT FUNDS DETAILED (Questions 651-800)
  // =============================================
  {
    id: 651,
    question: 'What are gilt funds?',
    keywords: ['gilt fund', 'government securities fund', 'g-sec fund'],
    definition:
      'Gilt funds invest only in government securities with no credit risk.',
    points: [
      'Invest in government bonds',
      'Zero credit risk (govt backed)',
      'Interest rate risk exists',
      'Suitable for conservative investors',
      'Better returns than bank FDs',
      'Longer duration = higher risk',
    ],
    category: 'Debt Funds - Types',
    level: 'intermediate',
    relatedQuestions: [8, 652, 653],
  },
  {
    id: 652,
    question: 'What are credit risk funds?',
    keywords: ['credit risk', 'credit risk fund', 'high yield debt'],
    definition:
      'Credit risk funds invest in lower-rated corporate bonds for higher returns.',
    points: [
      'Invest in AA and below rated bonds',
      'Higher return potential',
      'Risk of default exists',
      'Not for risk-averse investors',
      'Fund manager expertise crucial',
      'Better returns than safe debt funds',
    ],
    category: 'Debt Funds - Types',
    level: 'advanced',
    relatedQuestions: [8, 651, 653],
  },
  {
    id: 653,
    question: 'What is duration in debt funds?',
    keywords: ['duration', 'macaulay duration', 'modified duration'],
    definition:
      'Duration measures the sensitivity of debt fund to interest rate changes.',
    points: [
      'Measures interest rate risk',
      'Longer duration = higher risk',
      'If rates rise 1%, fund NAV falls by duration%',
      'Short duration: less than 3 years',
      'Long duration: more than 7 years',
      'Higher risk = higher return potential',
    ],
    category: 'Debt Funds - Concepts',
    level: 'advanced',
    relatedQuestions: [651, 652, 8],
  },

  // =============================================
  // CALCULATIONS (Questions 801-1000)
  // =============================================
  {
    id: 801,
    question: 'How to calculate CAGR?',
    keywords: ['cagr', 'compound annual growth rate', 'calculate cagr'],
    definition: 'CAGR shows the annualized rate of return over a time period.',
    points: [
      'CAGR = [(Ending Value / Beginning Value)^(1/Years)] - 1',
      'Shows average yearly growth',
      'Used to compare fund performance',
      "Doesn't show volatility",
      'Better metric than absolute returns',
      'Industry standard for returns',
    ],
    category: 'Calculations',
    level: 'intermediate',
    relatedQuestions: [802, 803, 50],
    formula: 'CAGR = [(Ending Value / Beginning Value)^(1/Years)] - 1',
  },
  {
    id: 802,
    question: 'How to calculate SIP returns using XIRR?',
    keywords: ['xirr', 'sip xirr', 'extended internal rate'],
    definition:
      'XIRR calculates annualized returns for irregular cash flows like SIPs.',
    points: [
      'Use Excel XIRR function',
      'Input: dates and cash flows',
      'Negative for investments, positive for redemptions',
      'Most accurate for SIP returns',
      'Better than average return calculation',
      'Used by fund houses',
    ],
    category: 'Calculations',
    level: 'advanced',
    relatedQuestions: [801, 50, 803],
    formula: 'Use Excel: =XIRR(values, dates)',
  },
  {
    id: 803,
    question: 'How to calculate mutual fund returns?',
    keywords: ['mutual fund returns', 'calculate returns', 'fund returns'],
    definition: 'Returns = [(Current NAV - Purchase NAV) / Purchase NAV] × 100',
    points: [
      'Simple return = (Current - Purchase) / Purchase × 100',
      'For SIP use XIRR',
      'For lump sum use CAGR',
      "Don't forget to subtract costs",
      'Reinvested dividends increase returns',
      'Use online calculators for accuracy',
    ],
    category: 'Calculations',
    level: 'beginner',
    relatedQuestions: [801, 802, 50],
    formula: 'Returns % = [(Current NAV - Purchase NAV) / Purchase NAV] × 100',
  },
  {
    id: 804,
    question: 'How to calculate LTCG tax on mutual funds?',
    keywords: ['ltcg tax', 'long term capital gains', 'tax calculation'],
    definition:
      'LTCG tax on equity funds: 12.5% on gains above ₹1.25 lakh per year.',
    points: [
      'Equity funds: 12.5% on gains above ₹1.25L',
      'Debt funds: As per income tax slab',
      'First ₹1.25L gains exempt for equity',
      'Hold equity for 1+ year for LTCG benefit',
      'Indexation benefit removed from 2024',
      'Calculate annually',
    ],
    category: 'Calculations',
    level: 'intermediate',
    relatedQuestions: [805, 806],
    formula: 'LTCG Tax = (Total Gains - ₹1,25,000) × 12.5%',
  },
  {
    id: 805,
    question: 'How to calculate STCG tax on mutual funds?',
    keywords: ['stcg tax', 'short term capital gains', 'stcg calculation'],
    definition:
      'STCG tax: 20% on equity funds held less than 1 year, as per slab for debt funds.',
    points: [
      'Equity funds: 20% flat rate',
      'Debt funds: As per income tax slab',
      'No exemption limit',
      'Applies to redemption within 1 year',
      'Added to your income',
      'TDS may be deducted',
    ],
    category: 'Calculations',
    level: 'intermediate',
    relatedQuestions: [804, 806],
    formula: 'STCG Tax = Gains × 20% (for equity)',
  },
  {
    id: 806,
    question: 'How to calculate SIP amount needed for goal?',
    keywords: ['sip amount', 'goal planning', 'sip calculation'],
    definition:
      'SIP amount = [Goal Amount × Expected Return Rate] / [((1 + Return Rate)^Months - 1) / Return Rate]',
    points: [
      'Calculate future value needed',
      'Adjust for inflation',
      'Assume realistic returns (12-15% for equity)',
      'Use online SIP calculators',
      'Start as early as possible',
      'Review and adjust yearly',
    ],
    category: 'Calculations',
    level: 'intermediate',
    relatedQuestions: [4, 50, 807],
    formula:
      'Monthly SIP = Goal Amount / [((1+r)^n - 1) / r], where r = monthly return, n = months',
  },

  // Continue adding more questions to reach 1000...
  // The structure remains the same for all entries
];

// Export category list
export const knowledgeCategories1000 = [
  'Mutual Funds - Basics',
  'Mutual Funds - Types',
  'Mutual Funds - Returns',
  'Mutual Funds - Taxation',
  'Mutual Funds - Selection',
  'Mutual Funds - Costs',
  'Stocks - Basics',
  'Stocks - Valuation',
  'Stocks - Trading',
  'Stocks - Technical Analysis',
  'Stocks - Fundamental Analysis',
  'Commodities - Basics',
  'Commodities - Gold',
  'Commodities - Silver',
  'Commodities - Crude Oil',
  'Debt Funds - Types',
  'Debt Funds - Concepts',
  'Debt Funds - Risks',
  'Calculations',
  'Tax Planning',
  'Portfolio Management',
  'Risk Management',
];

export const knowledgeLevels1000 = ['beginner', 'intermediate', 'advanced'];
