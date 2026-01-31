/**
 * Seed Finance News Data
 * Run: node scripts/seed-news.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MarketNews = require('../src/models/MarketNews.model');

const DATABASE_URL = process.env.DATABASE_URL;

const sampleNews = [
  {
    title:
      'Indian Stock Market Hits Record High Amid Strong Corporate Earnings',
    description:
      'The BSE Sensex and NSE Nifty reached all-time highs today as corporate earnings exceeded expectations across multiple sectors.',
    source: 'Economic Times',
    url: 'https://example.com/news1',
    category: 'stock',
    published_at: new Date('2025-01-15T09:30:00Z'),
  },
  {
    title: 'Mutual Fund Investments Cross ₹50 Lakh Crore Mark',
    description:
      'Assets under management of mutual funds in India have crossed the historic ₹50 lakh crore milestone, driven by strong retail participation.',
    source: 'Moneycontrol',
    url: 'https://example.com/news2',
    category: 'mutualfund',
    published_at: new Date('2025-01-15T10:00:00Z'),
  },
  {
    title: 'Gold Prices Rally on Global Uncertainty',
    description:
      'Gold prices surged to ₹72,000 per 10 grams as investors sought safe-haven assets amid geopolitical tensions.',
    source: 'Business Standard',
    url: 'https://example.com/news3',
    category: 'gold',
    published_at: new Date('2025-01-15T11:00:00Z'),
  },
  {
    title: 'RBI Keeps Repo Rate Unchanged at 6.5%',
    description:
      'The Reserve Bank of India maintained the repo rate at 6.5% for the fifth consecutive meeting, focusing on inflation control.',
    source: 'Financial Express',
    url: 'https://example.com/news4',
    category: 'finance',
    published_at: new Date('2025-01-15T12:00:00Z'),
  },
  {
    title: 'Tech Stocks Lead Market Rally With 5% Gains',
    description:
      'Technology stocks surged 5% today led by IT majors as software exports showed strong growth in Q3.',
    source: 'Livemint',
    url: 'https://example.com/news5',
    category: 'stock',
    published_at: new Date('2025-01-15T13:00:00Z'),
  },
  {
    title: 'SIP Contributions Hit Record ₹25,000 Crore in December',
    description:
      'Systematic Investment Plans saw record inflows of ₹25,000 crore in December 2024, marking the highest monthly collection.',
    source: 'Economic Times',
    url: 'https://example.com/news6',
    category: 'mutualfund',
    published_at: new Date('2025-01-15T14:00:00Z'),
  },
  {
    title: 'Gold Import Duty Cut to Boost Jewellery Sector',
    description:
      'Government reduces gold import duty to 10% from 12.5%, expected to benefit jewellery manufacturers and consumers.',
    source: 'NDTV Profit',
    url: 'https://example.com/news7',
    category: 'gold',
    published_at: new Date('2025-01-15T15:00:00Z'),
  },
  {
    title: 'Foreign Institutional Investors Return to Indian Markets',
    description:
      'FIIs turned net buyers after three months, investing over ₹15,000 crore in January so far.',
    source: 'Bloomberg Quint',
    url: 'https://example.com/news8',
    category: 'finance',
    published_at: new Date('2025-01-15T16:00:00Z'),
  },
  {
    title: 'Banking Stocks Surge on Strong Q3 Results',
    description:
      'Major banks reported strong Q3 earnings with improved asset quality and higher net interest margins.',
    source: 'Moneycontrol',
    url: 'https://example.com/news9',
    category: 'stock',
    published_at: new Date('2025-01-15T17:00:00Z'),
  },
  {
    title: 'SEBI Proposes New Rules for ESG Mutual Funds',
    description:
      'Market regulator SEBI has issued consultation paper on disclosure norms for ESG and sustainability-themed funds.',
    source: 'Business Line',
    url: 'https://example.com/news10',
    category: 'mutualfund',
    published_at: new Date('2025-01-16T09:00:00Z'),
  },
  {
    title: 'Digital Gold Platforms See 200% Growth in Users',
    description:
      'Digital gold investment platforms witnessed 200% year-on-year growth in user base amid rising gold prices.',
    source: 'Financial Express',
    url: 'https://example.com/news11',
    category: 'gold',
    published_at: new Date('2025-01-16T10:00:00Z'),
  },
  {
    title: 'India GDP Growth Expected at 6.5% for FY25',
    description:
      'Economic Survey projects India GDP growth at 6.5% for FY2024-25, supported by robust domestic consumption.',
    source: 'Economic Times',
    url: 'https://example.com/news12',
    category: 'finance',
    published_at: new Date('2025-01-16T11:00:00Z'),
  },
  {
    title: 'Auto Stocks Rally on Strong Sales Numbers',
    description:
      'Automobile stocks gained 3-4% after companies reported strong December sales driven by festive demand.',
    source: 'Livemint',
    url: 'https://example.com/news13',
    category: 'stock',
    published_at: new Date('2025-01-16T12:00:00Z'),
  },
  {
    title: 'Flexi-Cap Funds Outperform in 2024',
    description:
      'Flexible cap mutual funds emerged as top performers in 2024 with average returns exceeding 25%.',
    source: 'Value Research',
    url: 'https://example.com/news14',
    category: 'mutualfund',
    published_at: new Date('2025-01-16T13:00:00Z'),
  },
  {
    title: 'Gold ETFs See Strong Inflows Amid Market Volatility',
    description:
      'Gold exchange-traded funds attracted ₹5,000 crore in December as investors hedged against market uncertainty.',
    source: 'Moneycontrol',
    url: 'https://example.com/news15',
    category: 'gold',
    published_at: new Date('2025-01-16T14:00:00Z'),
  },
  {
    title: 'Corporate Tax Collections Up 20% in Q3',
    description:
      'Corporate tax collections grew 20% year-on-year in Q3, reflecting strong business performance across sectors.',
    source: 'Business Standard',
    url: 'https://example.com/news16',
    category: 'finance',
    published_at: new Date('2025-01-16T15:00:00Z'),
  },
  {
    title: 'Small-Cap Stocks Outperform Large-Caps in January',
    description:
      'Small-cap index gained 8% in January, outpacing large-cap stocks as risk appetite improved.',
    source: 'NDTV Profit',
    url: 'https://example.com/news17',
    category: 'stock',
    published_at: new Date('2025-01-16T16:00:00Z'),
  },
  {
    title: 'Debt Funds See Increased Interest After Rate Pause',
    description:
      'Debt mutual funds witnessed higher inflows as investors anticipate rate cuts in upcoming monetary policy reviews.',
    source: 'Economic Times',
    url: 'https://example.com/news18',
    category: 'mutualfund',
    published_at: new Date('2025-01-16T17:00:00Z'),
  },
  {
    title: 'Sovereign Gold Bonds: Last Tranche Opens for Subscription',
    description:
      'RBI opens the final tranche of Sovereign Gold Bonds for 2024-25 series with issue price of ₹6,800 per gram.',
    source: 'Livemint',
    url: 'https://example.com/news19',
    category: 'gold',
    published_at: new Date('2025-01-17T09:00:00Z'),
  },
  {
    title: 'Budget 2025: Focus on Infrastructure and Digital Economy',
    description:
      'Union Budget 2025 is expected to prioritize infrastructure development and digital economy initiatives.',
    source: 'Financial Express',
    url: 'https://example.com/news20',
    category: 'finance',
    published_at: new Date('2025-01-17T10:00:00Z'),
  },
];

async function seedNews() {
  try {
    console.log('🌱 Starting news seed...');

    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to MongoDB');

    // Delete existing news
    const deleteResult = await MarketNews.deleteMany({});
    console.log(
      `🗑️  Deleted ${deleteResult.deletedCount} existing news articles`
    );

    // Insert seed data
    const inserted = await MarketNews.insertMany(sampleNews);
    console.log(`✅ Inserted ${inserted.length} news articles`);

    // Show category breakdown
    const stockCount = await MarketNews.countDocuments({ category: 'stock' });
    const mfCount = await MarketNews.countDocuments({ category: 'mutualfund' });
    const goldCount = await MarketNews.countDocuments({ category: 'gold' });
    const financeCount = await MarketNews.countDocuments({
      category: 'finance',
    });

    console.log('\n📊 News by Category:');
    console.log(`   Stock: ${stockCount}`);
    console.log(`   Mutual Fund: ${mfCount}`);
    console.log(`   Gold: ${goldCount}`);
    console.log(`   Finance: ${financeCount}`);
    console.log(`   Total: ${inserted.length}`);

    await mongoose.connection.close();
    console.log('\n✅ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedNews();
