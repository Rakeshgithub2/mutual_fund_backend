import { prisma } from '../db';

const sampleNews = [
  {
    title: 'Mutual Funds See Record Inflows in October 2025',
    content:
      'Equity mutual funds witnessed their highest-ever monthly inflows of ₹40,608 crore in October 2025, reflecting strong investor confidence in the Indian stock market. Systematic Investment Plans (SIPs) contributed ₹23,547 crore to these inflows.',
    source: 'Economic Times',
    category: 'MARKET',
    tags: ['mutual funds', 'SIP', 'equity', 'inflows'],
    publishedAt: new Date('2025-11-06'),
  },
  {
    title: 'Nifty 50 Hits New All-Time High Above 24,800',
    content:
      'The benchmark Nifty 50 index scaled a fresh all-time high of 24,854 driven by strong corporate earnings and sustained foreign institutional investor buying. Banking and IT stocks led the rally.',
    source: 'Moneycontrol',
    category: 'MARKET',
    tags: ['Nifty 50', 'stock market', 'all-time high', 'banking', 'IT'],
    publishedAt: new Date('2025-11-05'),
  },
  {
    title: 'SEBI Introduces New Regulations for Mutual Fund Distributors',
    content:
      'The Securities and Exchange Board of India (SEBI) has announced new guidelines for mutual fund distributors, emphasizing transparency in commission disclosure and investor education requirements.',
    source: 'Business Standard',
    category: 'REGULATORY',
    tags: ['SEBI', 'regulations', 'mutual funds', 'distributors'],
    publishedAt: new Date('2025-11-04'),
  },
  {
    title: 'Small Cap Funds Outperform with 35% Annual Returns',
    content:
      'Small cap mutual funds have delivered impressive returns of over 35% in the past year, outpacing large cap and mid cap funds. However, experts caution investors about higher volatility in this segment.',
    source: 'LiveMint',
    category: 'FUND_SPECIFIC',
    tags: ['small cap', 'returns', 'performance', 'volatility'],
    publishedAt: new Date('2025-11-03'),
  },
  {
    title: 'Gold ETFs Gain Popularity Amid Market Uncertainty',
    content:
      'Gold Exchange Traded Funds (ETFs) have seen a surge in investor interest as gold prices touch ₹73,000 per 10 grams. These funds offer a convenient way to invest in gold without physical storage concerns.',
    source: 'Financial Express',
    category: 'MARKET',
    tags: ['Gold ETF', 'commodity', 'investment', 'gold prices'],
    publishedAt: new Date('2025-11-02'),
  },
  {
    title: 'Top 5 Large Cap Funds for Conservative Investors',
    content:
      'Financial advisors recommend large cap equity funds for conservative investors seeking steady returns with lower risk. Funds like HDFC Top 100, ICICI Bluechip, and Axis Bluechip have shown consistent performance over 5 years.',
    source: 'Value Research',
    category: 'FUND_SPECIFIC',
    tags: ['large cap', 'investment advice', 'conservative', 'bluechip'],
    publishedAt: new Date('2025-11-01'),
  },
  {
    title: 'FII Investment in Indian Markets Crosses $5 Billion',
    content:
      "Foreign Institutional Investors (FIIs) have pumped in over $5 billion into Indian equities this quarter, showing strong confidence in India's economic growth prospects and stable policy environment.",
    source: 'Economic Times',
    category: 'MARKET',
    tags: ['FII', 'foreign investment', 'Indian markets', 'equities'],
    publishedAt: new Date('2025-10-31'),
  },
  {
    title: 'Tax-Saving ELSS Funds: Best Options for 80C Deductions',
    content:
      'With the financial year end approaching, investors are looking at Equity Linked Savings Schemes (ELSS) for tax benefits under Section 80C. These funds offer dual benefits of tax savings and equity market participation.',
    source: 'Moneycontrol',
    category: 'FUND_SPECIFIC',
    tags: ['ELSS', 'tax saving', '80C', 'equity'],
    publishedAt: new Date('2025-10-30'),
  },
  {
    title: 'Mid Cap Stocks Rally on Strong Q2 Earnings',
    content:
      'Mid cap stocks have rallied sharply following better-than-expected Q2 earnings. Companies in pharma, chemicals, and consumer goods sectors have shown strong growth momentum.',
    source: 'Business Standard',
    category: 'MARKET',
    tags: ['mid cap', 'earnings', 'Q2 results', 'pharma', 'consumer goods'],
    publishedAt: new Date('2025-10-29'),
  },
  {
    title: 'SIP Investors Stay Committed Despite Market Volatility',
    content:
      'Despite recent market corrections, SIP investors have remained committed to their investment plans. Monthly SIP contributions have stayed above ₹20,000 crore for six consecutive months.',
    source: 'LiveMint',
    category: 'MARKET',
    tags: [
      'SIP',
      'systematic investment',
      'market volatility',
      'retail investors',
    ],
    publishedAt: new Date('2025-10-28'),
  },
  {
    title: 'Flexi Cap Funds: The New Favorite Among Investors',
    content:
      'Flexi cap funds have gained significant traction as they offer fund managers the flexibility to invest across market capitalizations. These funds have shown resilience during volatile market conditions.',
    source: 'Value Research',
    category: 'FUND_SPECIFIC',
    tags: ['flexi cap', 'multi cap', 'flexibility', 'fund management'],
    publishedAt: new Date('2025-10-27'),
  },
  {
    title: 'Index Funds vs Actively Managed Funds: 2025 Analysis',
    content:
      'A comprehensive analysis of index funds versus actively managed funds shows that while index funds offer lower costs, actively managed funds in India continue to generate alpha for investors in specific categories.',
    source: 'Financial Express',
    category: 'FUND_SPECIFIC',
    tags: ['index funds', 'active funds', 'comparison', 'alpha'],
    publishedAt: new Date('2025-10-26'),
  },
];

async function seedNews() {
  try {
    console.log('🌱 Starting news seed...');

    let createdCount = 0;
    let existingCount = 0;

    for (const newsItem of sampleNews) {
      const existing = await prisma.news.findFirst({
        where: { title: newsItem.title },
      });

      if (!existing) {
        await prisma.news.create({
          data: newsItem,
        });
        createdCount++;
        console.log(`✓ Created: ${newsItem.title}`);
      } else {
        existingCount++;
        console.log(`✓ Already exists: ${newsItem.title}`);
      }
    }

    console.log('\n🎉 News seeding completed!');
    console.log(
      `📊 Created: ${createdCount}, Already existed: ${existingCount}`
    );
  } catch (error) {
    console.error('❌ Error seeding news:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedNews();
