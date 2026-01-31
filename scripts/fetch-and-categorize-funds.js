require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

// MF API - Free tier
const MFAPI_BASE = 'https://api.mfapi.in/mf';

// Helper to normalize category/subcategory to lowercase
const normalizeCategory = (str) => {
  if (!str) return null;
  return str.toLowerCase().trim().replace(/\s+/g, '').replace(/-/g, '');
};

// Map fund names to subcategories using keywords
const classifyFund = (schemeName, category) => {
  if (!schemeName) return null;

  const name = schemeName.toLowerCase();

  if (category === 'equity') {
    // Large Cap
    if (
      name.includes('large cap') ||
      name.includes('largecap') ||
      name.includes('blue chip') ||
      name.includes('bluechip') ||
      name.includes('top 100')
    ) {
      return 'largecap';
    }

    // Mid Cap
    if (
      name.includes('mid cap') ||
      name.includes('midcap') ||
      name.includes('mid-cap') ||
      name.includes('midsize')
    ) {
      return 'midcap';
    }

    // Small Cap
    if (
      name.includes('small cap') ||
      name.includes('smallcap') ||
      name.includes('small-cap') ||
      name.includes('micro cap')
    ) {
      return 'smallcap';
    }

    // Multi Cap
    if (
      name.includes('multi cap') ||
      name.includes('multicap') ||
      name.includes('multi-cap') ||
      name.includes('diversified')
    ) {
      return 'multicap';
    }

    // Flexi Cap
    if (
      name.includes('flexi cap') ||
      name.includes('flexicap') ||
      name.includes('flexi-cap') ||
      name.includes('flexible')
    ) {
      return 'flexicap';
    }

    // Index Fund
    if (
      name.includes('index') ||
      name.includes('nifty') ||
      name.includes('sensex') ||
      name.includes('etf')
    ) {
      return 'indexfund';
    }

    // ELSS
    if (
      name.includes('elss') ||
      name.includes('tax saver') ||
      name.includes('tax saving') ||
      name.includes('80c')
    ) {
      return 'elss';
    }

    // Sectoral
    if (
      name.includes('pharma') ||
      name.includes('banking') ||
      name.includes('auto') ||
      name.includes('energy') ||
      name.includes('infra') ||
      name.includes('fmcg') ||
      name.includes('metal') ||
      name.includes('sector')
    ) {
      return 'sectoral';
    }

    // Thematic
    if (
      name.includes('thematic') ||
      name.includes('theme') ||
      name.includes('consumption') ||
      name.includes('digital') ||
      name.includes('manufacturing') ||
      name.includes('esg')
    ) {
      return 'thematic';
    }

    // Focused Fund
    if (name.includes('focused') || name.includes('focus')) {
      return 'focusedfund';
    }

    // Value Oriented
    if (name.includes('value') || name.includes('contra')) {
      return 'valueoriented';
    }

    // Dividend
    if (name.includes('dividend')) {
      return 'dividend';
    }

    // Default to generic equity
    return 'equity';
  }

  if (category === 'debt') {
    if (name.includes('liquid') || name.includes('overnight')) return 'liquid';
    if (name.includes('ultra short') || name.includes('ultrashort'))
      return 'ultrashort';
    if (name.includes('short') || name.includes('low duration'))
      return 'shortterm';
    if (name.includes('medium') || name.includes('dynamic bond'))
      return 'mediumterm';
    if (name.includes('long') || name.includes('gilt')) return 'longterm';
    if (name.includes('corporate') || name.includes('banking'))
      return 'corporatebond';
    if (name.includes('credit risk')) return 'creditrisk';
    if (name.includes('floater')) return 'floater';
    return 'debt';
  }

  if (category === 'hybrid') {
    if (name.includes('aggressive') || name.includes('equity oriented'))
      return 'aggressive';
    if (name.includes('conservative') || name.includes('debt oriented'))
      return 'conservative';
    if (name.includes('balanced') || name.includes('hybrid')) return 'balanced';
    if (name.includes('arbitrage')) return 'arbitrage';
    return 'hybrid';
  }

  return null;
};

// Determine category from scheme name
const determineCategory = (schemeName) => {
  if (!schemeName) return 'equity';

  const name = schemeName.toLowerCase();

  if (
    name.includes('debt') ||
    name.includes('bond') ||
    name.includes('gilt') ||
    name.includes('liquid') ||
    name.includes('income') ||
    name.includes('credit')
  ) {
    return 'debt';
  }

  if (
    name.includes('hybrid') ||
    name.includes('balanced') ||
    name.includes('arbitrage') ||
    name.includes('solution')
  ) {
    return 'hybrid';
  }

  if (name.includes('gold') || name.includes('commodity')) {
    return 'commodity';
  }

  // Default to equity
  return 'equity';
};

async function categorizeFunds() {
  try {
    console.log('\n🚀 FUND CATEGORIZATION SYSTEM\n');

    // Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    const Fund = mongoose.model(
      'Fund',
      new mongoose.Schema({}, { collection: 'funds', strict: false })
    );

    // Get all funds with generic subcategory
    console.log('🔍 Finding funds to categorize...');
    const uncategorized = await Fund.find({
      category: /^equity$/i,
      $or: [
        { subCategory: 'equity' },
        { subCategory: { $exists: false } },
        { subCategory: null },
      ],
    }).limit(10000);

    console.log(`Found ${uncategorized.length} funds to categorize\n`);

    // Categorize each fund
    let updated = 0;
    let errors = 0;
    const stats = {
      largecap: 0,
      midcap: 0,
      smallcap: 0,
      multicap: 0,
      flexicap: 0,
      indexfund: 0,
      elss: 0,
      sectoral: 0,
      thematic: 0,
      focusedfund: 0,
      valueoriented: 0,
      dividend: 0,
      equity: 0,
    };

    for (let i = 0; i < uncategorized.length; i++) {
      const fund = uncategorized[i];

      try {
        const category = normalizeCategory(fund.category || 'equity');
        const newSubCategory = classifyFund(fund.schemeName, category);

        if (newSubCategory && newSubCategory !== 'equity') {
          await Fund.updateOne(
            { _id: fund._id },
            {
              $set: {
                subCategory: newSubCategory,
                subcategory: newSubCategory,
                category: category,
              },
            }
          );
          stats[newSubCategory]++;
          updated++;

          if (updated % 100 === 0) {
            console.log(
              `✓ Processed ${updated}/${uncategorized.length} funds...`
            );
          }
        } else {
          stats.equity++;
        }
      } catch (err) {
        errors++;
        console.error(`Error updating fund ${fund.schemeCode}:`, err.message);
      }
    }

    console.log('\n📊 CATEGORIZATION COMPLETE\n');
    console.log('Updated funds:', updated);
    console.log('Errors:', errors);
    console.log('\nCategory Distribution:');
    Object.keys(stats)
      .sort((a, b) => stats[b] - stats[a])
      .forEach((cat) => {
        if (stats[cat] > 0) {
          console.log(
            `  ${cat.padEnd(20)}: ${stats[cat].toString().padStart(5)} funds`
          );
        }
      });

    // Verify final counts
    console.log('\n🔍 Verifying Database State...\n');
    const categories = [
      'largecap',
      'midcap',
      'smallcap',
      'multicap',
      'flexicap',
      'indexfund',
      'elss',
      'sectoral',
      'thematic',
      'focusedfund',
    ];

    for (const cat of categories) {
      const count = await Fund.countDocuments({
        category: /^equity$/i,
        $or: [
          { subCategory: new RegExp(`^${cat}$`, 'i') },
          { subcategory: new RegExp(`^${cat}$`, 'i') },
        ],
      });
      const status = count >= 500 ? '✓' : count >= 300 ? '⚠️' : '❌';
      console.log(
        `${cat.padEnd(20)}: ${count.toString().padStart(5)} funds ${status}`
      );
    }

    console.log('\n✅ Process complete!\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run the categorization
categorizeFunds();
