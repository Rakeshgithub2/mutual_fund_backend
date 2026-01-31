require('dotenv').config();
const mongoose = require('mongoose');

// Enhanced classification with flexicap as default for generic equity funds
const classifyFund = (schemeName) => {
  if (!schemeName) return 'flexicap';

  const name = schemeName.toLowerCase();

  // Index Fund (most specific, check first)
  if (name.match(/\b(index|etf|nifty|sensex)\b/)) {
    return 'indexfund';
  }

  // ELSS (tax-saving)
  if (name.match(/\b(elss|tax sav|80c)\b/)) {
    return 'elss';
  }

  // Sectoral (sector-specific)
  if (
    name.match(
      /\b(pharma|banking|bank|auto|energy|power|infra|fmcg|metal|sector|it |tech|healthcare|realty|psu)\b/
    )
  ) {
    return 'sectoral';
  }

  // Thematic
  if (
    name.match(
      /\b(thematic|theme|consumption|digital|manufacturing|esg|sustainable|green|innovation)\b/
    )
  ) {
    return 'thematic';
  }

  // Focused Fund
  if (name.match(/\bfocus/)) {
    return 'focusedfund';
  }

  // Value / Contrarian
  if (name.match(/\b(value|contra)/)) {
    return 'valueoriented';
  }

  // Dividend/Income (but not debt income funds)
  if (name.match(/\bdividend\b/) && !name.match(/\b(debt|bond|income)\b/)) {
    return 'dividend';
  }

  // Cap-based categories (check after specific categories)
  if (name.match(/\b(large.*cap|largecap|blue.*chip|top.*100|premier)\b/)) {
    return 'largecap';
  }

  if (
    name.match(/\b(mid.*cap|midcap|midsize|emerging)\b/) &&
    !name.match(/\b(large|small)\b/)
  ) {
    return 'midcap';
  }

  if (name.match(/\b(small.*cap|smallcap|micro.*cap)\b/)) {
    return 'smallcap';
  }

  if (name.match(/\b(multi.*cap|multicap|diversified|all.*cap)\b/)) {
    return 'multicap';
  }

  if (name.match(/\b(flexi.*cap|flexicap|flexible|opportunities)\b/)) {
    return 'flexicap';
  }

  // Generic equity keywords → classify as flexicap
  if (
    name.match(
      /\b(equity|growth|wealth|capital|advantage|premier|dynamic)\b/
    ) &&
    !name.match(/\b(debt|bond|income|hybrid)\b/)
  ) {
    return 'flexicap';
  }

  // Default: flexicap (most generic active equity category)
  return 'flexicap';
};

async function reclassifyGenericFunds() {
  try {
    console.log('\n🚀 ENHANCED FUND RECLASSIFICATION\n');

    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    const Fund = mongoose.model(
      'Fund',
      new mongoose.Schema({}, { collection: 'funds', strict: false })
    );

    // Get all equity funds with generic subcategory
    console.log('🔍 Finding generic equity funds...');
    const genericFunds = await Fund.find({
      category: /^equity$/i,
      subCategory: 'equity',
    }).limit(10000);

    console.log(
      `Found ${genericFunds.length} generic equity funds to reclassify\n`
    );

    const stats = {};
    let updated = 0;

    for (let i = 0; i < genericFunds.length; i++) {
      const fund = genericFunds[i];
      const newSubCategory = classifyFund(fund.schemeName);

      if (newSubCategory && newSubCategory !== 'equity') {
        await Fund.updateOne(
          { _id: fund._id },
          {
            $set: {
              subCategory: newSubCategory,
              subcategory: newSubCategory,
            },
          }
        );

        stats[newSubCategory] = (stats[newSubCategory] || 0) + 1;
        updated++;

        if (updated % 100 === 0) {
          console.log(
            `✓ Reclassified ${updated}/${genericFunds.length} funds...`
          );
        }
      }
    }

    console.log('\n📊 RECLASSIFICATION COMPLETE\n');
    console.log(`Updated: ${updated} funds\n`);
    console.log('Distribution:');
    Object.keys(stats)
      .sort((a, b) => stats[b] - stats[a])
      .forEach((cat) => {
        console.log(
          `  ${cat.padEnd(20)}: ${stats[cat].toString().padStart(5)} funds`
        );
      });

    // Final verification
    console.log('\n🔍 FINAL DATABASE STATE\n');
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

    let grandTotal = 0;
    for (const cat of categories) {
      const count = await Fund.countDocuments({
        category: /^equity$/i,
        $or: [
          { subCategory: new RegExp(`^${cat}$`, 'i') },
          { subcategory: new RegExp(`^${cat}$`, 'i') },
        ],
      });
      grandTotal += count;
      const status = count >= 500 ? '✅' : count >= 300 ? '⚠️' : '❌';
      console.log(
        `${cat.padEnd(20)}: ${count.toString().padStart(5)} funds ${status}`
      );
    }

    const remaining = await Fund.countDocuments({
      category: /^equity$/i,
      subCategory: 'equity',
    });

    console.log(`\nCategorized: ${grandTotal} funds`);
    console.log(`Remaining generic: ${remaining} funds`);
    console.log(`Total equity: ${grandTotal + remaining} funds\n`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

reclassifyGenericFunds();
