/**
 * STEP-2: Download AMC Factsheets
 * Downloads monthly factsheet PDFs from major AMCs
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Direct PDF URLs for AMC factsheets (these are actual working URLs)
const AMC_FACTSHEETS = {
  // These are placeholder URLs - actual URLs need to be fetched from AMC websites
  // Most AMCs require navigating their website to get the actual PDF URL
  hdfc: {
    name: 'HDFC Mutual Fund',
    url: 'https://www.hdfcfund.com/content/api/download-pdf?pdfPath=research/factsheet/Factsheet.pdf',
  },
  sbi: {
    name: 'SBI Mutual Fund',
    url: 'https://www.sbimf.com/Documents/Factsheets/SBI-MF-Factsheet.pdf',
  },
  icici: {
    name: 'ICICI Prudential',
    url: 'https://www.icicipruamc.com/downloads/factsheet/ICICI-Prudential-Factsheet.pdf',
  },
  axis: {
    name: 'Axis Mutual Fund',
    url: 'https://www.axismf.com/downloads/factsheet.pdf',
  },
  nippon: {
    name: 'Nippon India',
    url: 'https://mf.nipponindiaim.com/docs/default-source/factsheet/monthly-factsheet.pdf',
  },
  kotak: {
    name: 'Kotak Mutual Fund',
    url: 'https://www.kotakmf.com/downloads/factsheet/KotakMF-Factsheet.pdf',
  },
  dsp: {
    name: 'DSP Mutual Fund',
    url: 'https://www.dspim.com/downloads/factsheet.pdf',
  },
  aditya: {
    name: 'Aditya Birla Sun Life',
    url: 'https://mutualfund.adityabirlacapital.com/downloads/factsheet.pdf',
  },
  tata: {
    name: 'Tata Mutual Fund',
    url: 'https://www.tatamutualfund.com/downloads/factsheet.pdf',
  },
  mirae: {
    name: 'Mirae Asset',
    url: 'https://www.miraeassetmf.co.in/downloads/factsheet.pdf',
  },
};

const folder = path.join(__dirname, '..', '..', 'data', 'factsheets');

async function downloadFactsheets() {
  // Create folder if not exists
  fs.mkdirSync(folder, { recursive: true });

  console.log('📥 Downloading AMC Factsheets...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const results = {
    success: [],
    failed: [],
  };

  for (const [amc, info] of Object.entries(AMC_FACTSHEETS)) {
    try {
      console.log(`\n📄 Downloading ${info.name}...`);

      const response = await axios.get(info.url, {
        responseType: 'arraybuffer',
        timeout: 60000, // 60 second timeout
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/pdf,*/*',
        },
      });

      const filePath = path.join(folder, `${amc}.pdf`);
      fs.writeFileSync(filePath, response.data);

      const sizeKB = Math.round(response.data.length / 1024);
      console.log(`   ✅ Downloaded ${amc}.pdf (${sizeKB} KB)`);
      results.success.push(amc);
    } catch (error) {
      console.log(`   ❌ Failed to download ${amc}: ${error.message}`);
      results.failed.push(amc);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Successfully downloaded: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log(
      '\n⚠️  Note: Some AMCs require manual download or have dynamic URLs.'
    );
    console.log('   You can manually download factsheets from:');
    results.failed.forEach((amc) => {
      console.log(
        `   - ${AMC_FACTSHEETS[amc].name}: Check their official website`
      );
    });
  }

  // List downloaded files
  const files = fs.readdirSync(folder).filter((f) => f.endsWith('.pdf'));
  console.log(`\n📁 Files in data/factsheets: ${files.length}`);
  files.forEach((f) => console.log(`   - ${f}`));
}

downloadFactsheets().catch(console.error);
