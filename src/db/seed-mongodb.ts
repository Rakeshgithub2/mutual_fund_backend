import { MongoClient } from 'mongodb';
import { hashPassword } from '../utils/auth';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const mongoUrl =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual_funds_db';

async function main() {
  console.log('Starting database seed with MongoDB...');
  console.log('Connecting to:', mongoUrl);

  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db();

    // Create admin user
    const adminPassword = await hashPassword('admin123');
    const usersCollection = db.collection('users');

    const existingAdmin = await usersCollection.findOne({
      email: 'admin@mutualfunds.com',
    });

    if (!existingAdmin) {
      await usersCollection.insertOne({
        email: 'admin@mutualfunds.com',
        password: adminPassword,
        name: 'Admin User',
        role: 'ADMIN',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(
        '✓ Admin user created: admin@mutualfunds.com (password: admin123)'
      );
    } else {
      console.log('✓ Admin user already exists: admin@mutualfunds.com');
    }

    // Create sample test user
    const testUserPassword = await hashPassword('test123');
    const existingTestUser = await usersCollection.findOne({
      email: 'test@example.com',
    });

    if (!existingTestUser) {
      await usersCollection.insertOne({
        email: 'test@example.com',
        password: testUserPassword,
        name: 'Test User',
        role: 'USER',
        isVerified: true,
        age: 30,
        riskLevel: 'MEDIUM',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✓ Test user created: test@example.com (password: test123)');
    } else {
      console.log('✓ Test user already exists: test@example.com');
    }

    // Create sample funds
    const fundsCollection = db.collection('funds');

    const funds = [
      {
        amfiCode: 'HDFC001',
        name: 'HDFC Top 100 Fund',
        type: 'EQUITY',
        category: 'LARGE_CAP',
        benchmark: 'Nifty 100',
        expenseRatio: 1.25,
        description: 'Large cap equity fund investing in top 100 companies',
        inceptionDate: new Date('2010-01-01'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'ICICI001',
        name: 'ICICI Prudential Value Discovery Fund',
        type: 'EQUITY',
        category: 'MID_CAP',
        benchmark: 'Nifty Midcap 100',
        expenseRatio: 1.85,
        description: 'Mid cap value focused equity fund',
        inceptionDate: new Date('2012-06-15'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'SBI001',
        name: 'SBI Small Cap Fund',
        type: 'EQUITY',
        category: 'SMALL_CAP',
        benchmark: 'Nifty Smallcap 100',
        expenseRatio: 2.15,
        description: 'Small cap growth focused equity fund',
        inceptionDate: new Date('2015-03-20'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'AXIS001',
        name: 'Axis Bluechip Fund',
        type: 'EQUITY',
        category: 'LARGE_CAP',
        benchmark: 'Nifty 50',
        expenseRatio: 0.65,
        description:
          'Flagship large cap fund focusing on quality bluechip stocks',
        inceptionDate: new Date('2008-12-29'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'MIRAE001',
        name: 'Mirae Asset Emerging Bluechip Fund',
        type: 'EQUITY',
        category: 'MID_CAP',
        benchmark: 'Nifty Midcap 150',
        expenseRatio: 0.85,
        description: 'Mid cap fund investing in emerging quality businesses',
        inceptionDate: new Date('2013-07-03'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'KOTAK001',
        name: 'Kotak Standard Multicap Fund',
        type: 'EQUITY',
        category: 'MULTI_CAP',
        benchmark: 'Nifty 500',
        expenseRatio: 0.75,
        description:
          'Multi cap fund with flexible allocation across market caps',
        inceptionDate: new Date('2011-04-10'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'SBI002',
        name: 'SBI Bluechip Fund',
        type: 'EQUITY',
        category: 'LARGE_CAP',
        benchmark: 'Nifty 50',
        expenseRatio: 0.7,
        description:
          'Large cap fund investing in established bluechip companies',
        inceptionDate: new Date('2006-02-14'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'HDFC002',
        name: 'HDFC Mid-Cap Opportunities Fund',
        type: 'EQUITY',
        category: 'MID_CAP',
        benchmark: 'Nifty Midcap 150',
        expenseRatio: 1.15,
        description: 'Mid cap fund focusing on growth opportunities',
        inceptionDate: new Date('2007-06-28'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Additional Large Cap Funds
      {
        amfiCode: 'ICICI002',
        name: 'ICICI Prudential Bluechip Fund',
        type: 'EQUITY',
        category: 'LARGE_CAP',
        benchmark: 'Nifty 50',
        expenseRatio: 0.85,
        description: 'Large cap fund investing in quality bluechip stocks',
        inceptionDate: new Date('2008-05-01'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'AXIS002',
        name: 'Axis Focused 25 Fund',
        type: 'EQUITY',
        category: 'LARGE_CAP',
        expenseRatio: 0.55,
        description: 'Concentrated large cap portfolio of 25 quality stocks',
        inceptionDate: new Date('2013-01-01'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'PARAG001',
        name: 'Parag Parikh Flexi Cap Fund',
        type: 'EQUITY',
        category: 'LARGE_CAP',
        benchmark: 'Nifty 500',
        expenseRatio: 0.68,
        description: 'Large cap focused flexi cap fund with global exposure',
        inceptionDate: new Date('2013-05-28'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'FRANK001',
        name: 'Franklin India Bluechip Fund',
        type: 'EQUITY',
        category: 'LARGE_CAP',
        benchmark: 'Nifty 50',
        expenseRatio: 0.72,
        description:
          'Well-established large cap fund with consistent track record',
        inceptionDate: new Date('2011-11-15'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Additional Mid Cap Funds
      {
        amfiCode: 'AXIS003',
        name: 'Axis Midcap Fund',
        type: 'EQUITY',
        category: 'MID_CAP',
        benchmark: 'Nifty Midcap 150',
        expenseRatio: 0.58,
        description: 'Mid cap fund with focus on quality and growth',
        inceptionDate: new Date('2011-03-30'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'KOTAK002',
        name: 'Kotak Emerging Equity Fund',
        type: 'EQUITY',
        category: 'MID_CAP',
        benchmark: 'Nifty Midcap 100',
        expenseRatio: 0.95,
        description: 'Mid cap fund identifying emerging market leaders',
        inceptionDate: new Date('2007-03-30'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'FRANK002',
        name: 'Franklin India Prima Fund',
        type: 'EQUITY',
        category: 'MID_CAP',
        benchmark: 'Nifty Midcap 100',
        expenseRatio: 1.05,
        description: 'Mid cap fund with consistent alpha generation',
        inceptionDate: new Date('1993-12-31'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'DSP001',
        name: 'DSP Midcap Fund',
        type: 'EQUITY',
        category: 'MID_CAP',
        benchmark: 'Nifty Midcap 150',
        expenseRatio: 0.88,
        description: 'Mid cap fund with bottom-up stock selection approach',
        inceptionDate: new Date('2006-11-07'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Additional Small Cap Funds
      {
        amfiCode: 'AXIS004',
        name: 'Axis Small Cap Fund',
        type: 'EQUITY',
        category: 'SMALL_CAP',
        benchmark: 'Nifty Smallcap 250',
        expenseRatio: 0.65,
        description: 'Small cap fund focusing on high growth potential stocks',
        inceptionDate: new Date('2013-09-20'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'KOTAK003',
        name: 'Kotak Small Cap Fund',
        type: 'EQUITY',
        category: 'SMALL_CAP',
        benchmark: 'Nifty Smallcap 250',
        expenseRatio: 1.25,
        description: 'Small cap fund with focus on emerging businesses',
        inceptionDate: new Date('2005-02-24'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'NIPPON001',
        name: 'Nippon India Small Cap Fund',
        type: 'EQUITY',
        category: 'SMALL_CAP',
        benchmark: 'Nifty Smallcap 100',
        expenseRatio: 1.15,
        description: 'Small cap fund with strong research-driven approach',
        inceptionDate: new Date('2010-09-01'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'HDFC003',
        name: 'HDFC Small Cap Fund',
        type: 'EQUITY',
        category: 'SMALL_CAP',
        benchmark: 'Nifty Smallcap 250',
        expenseRatio: 1.18,
        description: 'Small cap fund with proven track record',
        inceptionDate: new Date('2008-04-15'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'SBI003',
        name: 'SBI Small Cap Fund',
        type: 'EQUITY',
        category: 'SMALL_CAP',
        benchmark: 'Nifty Smallcap 100',
        expenseRatio: 1.32,
        description: 'Small cap fund for aggressive growth investors',
        inceptionDate: new Date('2009-09-30'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Commodity & Gold ETFs
      {
        amfiCode: 'GOLD001',
        name: 'SBI Gold ETF',
        type: 'Commodity',
        category: 'GOLD_ETF',
        subCategory: 'gold',
        fundHouse: 'SBI Mutual Fund',
        nav: 58.42,
        aum: 1250,
        returns: {
          '1Y': 12.5,
          '3Y': 15.8,
          '5Y': 11.2,
        },
        riskLevel: 'Moderate',
        minInvestment: 100,
        exitLoad: 0,
        benchmark: 'Gold Price Index',
        expenseRatio: 0.5,
        description: 'Gold ETF tracking domestic gold prices',
        inceptionDate: new Date('2009-05-20'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'GOLD002',
        name: 'HDFC Gold ETF',
        type: 'Commodity',
        category: 'GOLD_ETF',
        subCategory: 'gold',
        fundHouse: 'HDFC Mutual Fund',
        nav: 55.78,
        aum: 980,
        returns: {
          '1Y': 12.3,
          '3Y': 15.5,
          '5Y': 11.0,
        },
        riskLevel: 'Moderate',
        minInvestment: 100,
        exitLoad: 0,
        benchmark: 'Gold Price Index',
        expenseRatio: 0.55,
        description: 'ETF providing exposure to physical gold',
        inceptionDate: new Date('2010-01-15'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'GOLD003',
        name: 'Nippon India Gold ETF',
        type: 'Commodity',
        category: 'GOLD_ETF',
        subCategory: 'gold',
        fundHouse: 'Nippon India Mutual Fund',
        nav: 56.92,
        aum: 750,
        returns: {
          '1Y': 12.8,
          '3Y': 16.1,
          '5Y': 11.5,
        },
        riskLevel: 'Moderate',
        minInvestment: 100,
        exitLoad: 0,
        benchmark: 'Gold Price Index',
        expenseRatio: 0.52,
        description: 'Gold ETF for portfolio diversification',
        inceptionDate: new Date('2011-03-10'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'SILV001',
        name: 'Axis Silver ETF',
        type: 'Commodity',
        category: 'SILVER_ETF',
        subCategory: 'silver',
        fundHouse: 'Axis Mutual Fund',
        nav: 72.15,
        aum: 420,
        returns: {
          '1Y': 8.5,
          '3Y': 12.3,
          '5Y': 9.8,
        },
        riskLevel: 'Moderate to High',
        minInvestment: 100,
        exitLoad: 0,
        benchmark: 'Silver Price Index',
        expenseRatio: 0.65,
        description: 'Silver ETF tracking domestic silver prices',
        inceptionDate: new Date('2017-06-22'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        amfiCode: 'COMM001',
        name: 'ICICI Prudential Commodities Fund',
        type: 'Commodity',
        category: 'COMMODITY',
        subCategory: 'multicommodity',
        fundHouse: 'ICICI Prudential Mutual Fund',
        nav: 18.65,
        aum: 350,
        returns: {
          '1Y': 7.2,
          '3Y': 10.5,
          '5Y': 8.9,
        },
        riskLevel: 'Moderate to High',
        minInvestment: 5000,
        exitLoad: 0.5,
        benchmark: 'Multi-Commodity Index',
        expenseRatio: 1.15,
        description: 'Fund investing in commodity-based securities',
        inceptionDate: new Date('2020-08-12'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    let fundCount = 0;
    for (const fund of funds) {
      const existingFund = await fundsCollection.findOne({
        amfiCode: fund.amfiCode,
      });

      if (!existingFund) {
        await fundsCollection.insertOne(fund);
        fundCount++;
        console.log(`✓ Created fund: ${fund.name}`);
      } else {
        console.log(`✓ Fund already exists: ${fund.name}`);
      }
    }

    // Add some sample NAV data for the first fund
    const firstFund = await fundsCollection.findOne({ amfiCode: 'HDFC001' });
    if (firstFund) {
      const performancesCollection = db.collection('fund_performances');
      const existingPerformances = await performancesCollection.countDocuments({
        fundId: firstFund._id,
      });

      if (existingPerformances === 0) {
        const navData = [];
        const today = new Date();
        for (let i = 30; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          navData.push({
            fundId: firstFund._id,
            date: date,
            nav: 45.32 + (Math.random() - 0.5) * 5,
            createdAt: new Date(),
          });
        }
        await performancesCollection.insertMany(navData);
        console.log(`✓ Added 31 days of NAV data for ${firstFund.name}`);
      }
    }

    // Add news articles
    const newsCollection = db.collection('news');
    const newsArticles = [
      {
        title: 'Mutual Funds See Record Inflows in October 2025',
        content:
          'Equity mutual funds witnessed their highest-ever monthly inflows of ₹40,608 crore in October 2025, reflecting strong investor confidence in the Indian stock market. Systematic Investment Plans (SIPs) contributed ₹23,547 crore to these inflows.',
        source: 'Economic Times',
        category: 'MARKET',
        tags: ['mutual funds', 'SIP', 'equity', 'inflows'],
        publishedAt: new Date('2025-11-06'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'SEBI Introduces New Guidelines for Mutual Fund Investments',
        content:
          'The Securities and Exchange Board of India (SEBI) has announced new guidelines aimed at enhancing transparency and investor protection in mutual fund investments. The changes include stricter disclosure norms and faster grievance redressal mechanisms.',
        source: 'Business Standard',
        category: 'REGULATION',
        tags: ['SEBI', 'regulations', 'investor protection'],
        publishedAt: new Date('2025-11-05'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Gold ETFs Gain Popularity Amid Market Volatility',
        content:
          'Gold Exchange Traded Funds (ETFs) have seen a surge in demand as investors seek safe-haven assets during recent market fluctuations. Gold prices touched ₹65,000 per 10 grams, driving interest in gold-backed investment instruments.',
        source: 'Mint',
        category: 'COMMODITIES',
        tags: ['gold', 'ETF', 'safe haven'],
        publishedAt: new Date('2025-11-04'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Tech Sector Funds Outperform Benchmark Indices',
        content:
          'Technology-focused mutual funds have delivered exceptional returns, outperforming major benchmark indices by 8-12% in the past quarter. Strong earnings from IT giants and optimistic global tech outlook fuel the rally.',
        source: 'Financial Express',
        category: 'SECTOR',
        tags: ['technology', 'performance', 'IT sector'],
        publishedAt: new Date('2025-11-03'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Small Cap Funds: High Returns Come with Higher Risks',
        content:
          'Financial advisors caution investors about the volatility in small-cap mutual funds despite their attractive returns. Experts recommend limiting exposure to 15-20% of the overall equity portfolio for risk management.',
        source: 'MoneyControl',
        category: 'ANALYSIS',
        tags: ['small cap', 'risk', 'portfolio'],
        publishedAt: new Date('2025-11-02'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Direct vs Regular Plans: Understanding the Cost Difference',
        content:
          'A comparative analysis reveals that direct mutual fund plans have saved investors up to 1.5% annually in expense ratios compared to regular plans. This difference can significantly impact long-term wealth creation.',
        source: 'Value Research',
        category: 'EDUCATION',
        tags: ['direct plans', 'expense ratio', 'cost'],
        publishedAt: new Date('2025-11-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'ESG Funds Attract Millennial Investors',
        content:
          'Environmental, Social, and Governance (ESG) focused mutual funds are witnessing growing interest from millennial investors who prioritize sustainable and responsible investing alongside financial returns.',
        source: 'Bloomberg Quint',
        category: 'TRENDS',
        tags: ['ESG', 'millennials', 'sustainable investing'],
        publishedAt: new Date('2025-10-31'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Debt Funds Face Pressure from Rising Interest Rates',
        content:
          'Debt mutual funds are experiencing outflows as the Reserve Bank of India maintains its hawkish stance on interest rates. Fund managers are repositioning portfolios to navigate the challenging fixed-income environment.',
        source: 'Economic Times',
        category: 'FIXED_INCOME',
        tags: ['debt funds', 'interest rates', 'RBI'],
        publishedAt: new Date('2025-10-30'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Tax-Saving ELSS Funds: Beat the March Rush',
        content:
          'Financial planners advise starting tax-saving investments in ELSS (Equity Linked Savings Scheme) funds early in the financial year to benefit from rupee cost averaging and avoid the year-end rush.',
        source: 'Mint',
        category: 'TAX',
        tags: ['ELSS', 'tax saving', '80C'],
        publishedAt: new Date('2025-10-29'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Index Funds vs Actively Managed Funds: The Ongoing Debate',
        content:
          'Recent data shows that over 60% of actively managed large-cap funds failed to beat their benchmark indices over a 5-year period, reigniting the debate about the merits of passive investing through index funds.',
        source: 'Business Standard',
        category: 'ANALYSIS',
        tags: ['index funds', 'active funds', 'performance'],
        publishedAt: new Date('2025-10-28'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'International Funds Offer Global Diversification',
        content:
          'International equity mutual funds are gaining traction as investors seek geographical diversification. Funds focused on US tech stocks and emerging markets have shown strong performance.',
        source: 'Financial Express',
        category: 'INTERNATIONAL',
        tags: ['international funds', 'diversification', 'global'],
        publishedAt: new Date('2025-10-27'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Mutual Fund AUM Crosses ₹50 Lakh Crore Milestone',
        content:
          'The Indian mutual fund industry has achieved a historic milestone with total Assets Under Management (AUM) crossing ₹50 lakh crore, driven by increasing retail participation and strong market performance.',
        source: 'MoneyControl',
        category: 'INDUSTRY',
        tags: ['AUM', 'milestone', 'growth'],
        publishedAt: new Date('2025-10-26'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    let newsCount = 0;
    for (const article of newsArticles) {
      const existingNews = await newsCollection.findOne({
        title: article.title,
      });

      if (!existingNews) {
        await newsCollection.insertOne(article);
        newsCount++;
        console.log(`✓ Created news: ${article.title}`);
      } else {
        console.log(`✓ News already exists: ${article.title}`);
      }
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log(
      `📊 Total: ${fundCount} new funds, ${funds.length - fundCount} existing`
    );
    console.log(
      `📰 News: ${newsCount} new articles, ${newsArticles.length - newsCount} existing`
    );
    console.log('\n📝 Test Credentials:');
    console.log('   Admin: admin@mutualfunds.com / admin123');
    console.log('   User:  test@example.com / test123');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✓ Database connection closed');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
