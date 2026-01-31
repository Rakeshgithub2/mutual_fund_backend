import { Request, Response } from 'express';
import { mongodb } from '../db/mongodb';
import axios from 'axios';

interface Fund {
  fundId: string;
  amfiCode?: string;
  name: string;
  category: string;
  subCategory: string;
  fundType: string;
  fundHouse: string;
  fundManager?: string;
  currentNav?: number;
  previousNav?: number;
  navDate?: Date;
  returns?: {
    day?: number;
    week?: number;
    month?: number;
    threeMonth?: number;
    sixMonth?: number;
    oneYear?: number;
    threeYear?: number;
    fiveYear?: number;
  };
  aum?: number;
  expenseRatio?: number;
  riskLevel?: string;
  riskMetrics?: any;
  ratings?: any;
  launchDate?: Date;
  benchmark?: string;
  minInvestment?: number;
  sipMinAmount?: number;
  exitLoad?: number;
  holdings?: Array<{
    name: string;
    ticker?: string;
    percentage: number;
    sector: string;
  }>;
  sectorAllocation?: Array<{
    sector: string;
    percentage: number;
  }>;
  tags?: string[];
  searchTerms?: string[];
  popularity?: number;
  isActive: boolean;
  dataSource?: string;
  lastUpdated?: Date;
  createdAt?: Date;
}

// Fetch and store funds from external API if DB is empty
async function fetchAndStoreFunds(): Promise<void> {
  try {
    const collection = mongodb.getCollection('funds');

    console.log('📥 Fetching funds from AMFI/external source...');

    // Check if we already have funds
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`✅ Database already has ${existingCount} funds`);
      return;
    }

    // Fetch from AMFI or external API
    // Using a public API endpoint for mutual fund data
    const response = await axios.get('https://api.mfapi.in/mf', {
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.data || !Array.isArray(response.data)) {
      console.log('⚠️ No fund data received, using mock data');
      await insertMockFunds(collection);
      return;
    }

    const fundsData = response.data;
    console.log(`📊 Fetched ${fundsData.length} funds from API`);

    // Transform and insert funds
    const funds: Fund[] = fundsData
      .slice(0, 500)
      .map((fund: any, index: number) => ({
        fundId: fund.schemeCode || `FUND${String(index + 1).padStart(6, '0')}`,
        amfiCode: fund.schemeCode,
        name: fund.schemeName || `Fund ${index + 1}`,
        category: categorizeScheme(fund.schemeName),
        subCategory: getSubCategory(fund.schemeName),
        fundType: 'mutual_fund',
        fundHouse: extractFundHouse(fund.schemeName),
        currentNav: 0,
        returns: {
          oneYear: 0,
          threeYear: 0,
          fiveYear: 0,
        },
        aum: 0,
        expenseRatio: 0,
        riskLevel: 'MEDIUM',
        holdings: [],
        sectorAllocation: [],
        isActive: true,
      }));

    if (funds.length > 0) {
      await collection.insertMany(funds);
      console.log(`✅ Inserted ${funds.length} funds into database`);
    } else {
      await insertMockFunds(collection);
    }
  } catch (error: any) {
    console.error('❌ Error fetching funds:', error.message);
    // Insert mock funds as fallback
    const collection = mongodb.getCollection('funds');
    await insertMockFunds(collection);
  }
}

async function insertMockFunds(collection: any): Promise<void> {
  const mockFunds: Fund[] = [
    {
      fundId: 'FUND001',
      amfiCode: '119551',
      name: 'HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth',
      category: 'equity',
      subCategory: 'midcap',
      fundType: 'mutual_fund',
      fundHouse: 'HDFC',
      currentNav: 189.45,
      returns: {
        oneYear: 42.5,
        threeYear: 28.3,
        fiveYear: 22.1,
      },
      aum: 45000,
      expenseRatio: 0.68,
      riskLevel: 'HIGH',
      isActive: true,
    },
    {
      fundId: 'FUND002',
      amfiCode: '120503',
      name: 'SBI Blue Chip Fund - Direct Plan - Growth',
      category: 'equity',
      subCategory: 'largecap',
      fundType: 'mutual_fund',
      fundHouse: 'SBI',
      currentNav: 125.67,
      returns: {
        oneYear: 35.2,
        threeYear: 24.8,
        fiveYear: 19.5,
      },
      aum: 38000,
      expenseRatio: 0.52,
      riskLevel: 'MEDIUM',
      isActive: true,
    },
    {
      fundId: 'FUND003',
      amfiCode: '118989',
      name: 'Axis Bluechip Fund - Direct Plan - Growth',
      category: 'equity',
      subCategory: 'largecap',
      fundType: 'mutual_fund',
      fundHouse: 'Axis',
      currentNav: 87.32,
      returns: {
        oneYear: 38.7,
        threeYear: 26.4,
        fiveYear: 21.3,
      },
      aum: 52000,
      expenseRatio: 0.45,
      riskLevel: 'MEDIUM',
      isActive: true,
    },
  ];

  const existingCount = await collection.countDocuments();
  if (existingCount === 0) {
    await collection.insertMany(mockFunds);
    console.log(`✅ Inserted ${mockFunds.length} mock funds`);
  }
}

function categorizeScheme(schemeName: string): string {
  const name = schemeName.toLowerCase();
  if (
    name.includes('equity') ||
    name.includes('bluechip') ||
    name.includes('mid cap') ||
    name.includes('small cap') ||
    name.includes('large cap')
  ) {
    return 'equity';
  } else if (
    name.includes('debt') ||
    name.includes('gilt') ||
    name.includes('liquid') ||
    name.includes('income')
  ) {
    return 'debt';
  } else if (name.includes('hybrid') || name.includes('balanced')) {
    return 'hybrid';
  } else if (
    name.includes('gold') ||
    name.includes('silver') ||
    name.includes('commodity')
  ) {
    return 'commodity';
  } else if (name.includes('etf') || name.includes('exchange traded')) {
    return 'etf';
  }
  return 'equity';
}

function getSubCategory(schemeName: string): string {
  const name = schemeName.toLowerCase();
  if (name.includes('large cap') || name.includes('bluechip'))
    return 'largecap';
  if (name.includes('mid cap')) return 'midcap';
  if (name.includes('small cap')) return 'smallcap';
  if (name.includes('multi cap') || name.includes('multicap'))
    return 'multicap';
  if (name.includes('flexi cap') || name.includes('flexicap'))
    return 'flexicap';
  if (name.includes('elss') || name.includes('tax')) return 'elss';
  if (name.includes('gold')) return 'gold';
  if (name.includes('silver')) return 'silver';
  if (name.includes('liquid')) return 'liquid';
  if (name.includes('overnight')) return 'overnight';
  return 'others';
}

function extractFundHouse(schemeName: string): string {
  const houses = [
    'HDFC',
    'ICICI',
    'SBI',
    'Axis',
    'Aditya Birla',
    'UTI',
    'Kotak',
    'DSP',
    'Franklin',
    'Nippon',
    'Mirae',
  ];
  for (const house of houses) {
    if (schemeName.toLowerCase().includes(house.toLowerCase())) {
      return house;
    }
  }
  return 'Others';
}

// GET /api/funds - Get all funds with pagination
export async function getAllFunds(req: Request, res: Response): Promise<void> {
  try {
    console.log('📥 GET /api/funds - Request received');

    await mongodb.connect();
    const collection = mongodb.getCollection('funds');

    // Check if DB has funds, if not fetch and store
    const count = await collection.countDocuments();
    if (count === 0) {
      console.log('📦 Database empty, fetching funds...');
      await fetchAndStoreFunds();
    }

    // Parse query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 50)
    );
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};

    // Only filter by isActive if funds have this field
    const sampleFund = await collection.findOne({});
    if (sampleFund && 'isActive' in sampleFund) {
      filter.isActive = true;
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.subCategory) {
      filter.subCategory = req.query.subCategory;
    }

    if (req.query.fundHouse) {
      filter.fundHouse = req.query.fundHouse;
    }

    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }

    // Get total count
    const total = await collection.countDocuments(filter);

    // Get funds
    const funds = await collection
      .find(filter)
      .sort({ aum: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    console.log(
      `✅ Returning ${funds.length} funds (page ${page} of ${Math.ceil(total / limit)})`
    );

    res.json({
      success: true,
      data: funds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('❌ Error in getAllFunds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch funds',
      message: error.message,
    });
  }
}

// GET /api/funds/:id - Get fund by ID
export async function getFundById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    console.log(`📥 GET /api/funds/${id} - Request received`);

    await mongodb.connect();
    const collection = mongodb.getCollection('funds');

    // Try multiple ID formats - decode URL-encoded ID
    const decodedId = decodeURIComponent(id);

    // Try to find by fundId, amfiCode, name match, or _id
    let fund = await collection.findOne({
      $or: [
        { fundId: id },
        { fundId: decodedId },
        { amfiCode: id },
        { amfiCode: decodedId },
        { name: { $regex: decodedId.replace(/_/g, ' '), $options: 'i' } },
      ],
    });

    // If still not found, try exact name match
    if (!fund) {
      fund = await collection.findOne({
        name: { $regex: decodedId.split('_').join('.*'), $options: 'i' },
      });
    }

    if (!fund) {
      console.log(`❌ Fund not found: ${id} (decoded: ${decodedId})`);
      res.status(404).json({
        success: false,
        error: 'Fund not found',
        message: `No fund found with ID: ${id}`,
      });
      return;
    }

    console.log(`✅ Found fund: ${fund.name}`);

    res.json({
      success: true,
      data: fund,
    });
  } catch (error: any) {
    console.error('❌ Error in getFundById:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fund details',
      message: error.message,
    });
  }
}
