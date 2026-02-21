/**
 * STEP-3: Extract Holdings from PDF Factsheets
 * Parses AMC factsheet PDFs to extract top holdings
 */
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

/**
 * Parse holdings from a factsheet PDF
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<Array>} - Array of holdings
 */
async function parseHoldings(pdfPath) {
  try {
    const buffer = fs.readFileSync(pdfPath);
    const parser = new PDFParse(buffer);
    const data = await parser.parse();

    // Get all text from pages
    let text = '';
    for (const page of data.pages) {
      text += page.text + '\n';
    }

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);

    const holdings = [];

    // Multiple regex patterns to catch different PDF formats
    const patterns = [
      // Pattern 1: Company Name followed by percentage
      /^([A-Za-z][A-Za-z0-9\s.&'(),-]+?)\s+(\d{1,2}\.\d{1,2})\s*%?$/,
      // Pattern 2: Company Name | Percentage
      /^([A-Za-z][A-Za-z0-9\s.&'(),-]+?)\s*[|]\s*(\d{1,2}\.\d{1,2})\s*%?$/,
      // Pattern 3: Inline percentage
      /([A-Za-z][A-Za-z0-9\s.&'(),-]+?)\s+(\d{1,2}\.\d{1,2})%/g,
    ];

    // Known Indian stock names to help identify holdings
    const knownStocks = [
      'HDFC Bank',
      'ICICI Bank',
      'Reliance',
      'Infosys',
      'TCS',
      'Tata',
      'Bharti Airtel',
      'ITC',
      'Kotak',
      'Axis Bank',
      'SBI',
      'State Bank',
      'HUL',
      'Hindustan Unilever',
      'Bajaj',
      'Maruti',
      'Sun Pharma',
      'Larsen',
      'L&T',
      'NTPC',
      'Power Grid',
      'Tech Mahindra',
      'Wipro',
      'Asian Paints',
      'Titan',
      'Nestle',
      'Ultratech',
      'JSW',
      'Tata Steel',
      'Mahindra',
      'Adani',
      'Coal India',
      'ONGC',
      'Grasim',
      'Cipla',
      'Dr Reddy',
      'Divis',
      'Apollo',
      'Eicher',
      'Hero',
      'Bajaj Finance',
      'HDFC Life',
      'SBI Life',
      'ICICI Prudential',
      'Godrej',
      'Dabur',
      'Britannia',
      'Marico',
      'Pidilite',
      'Berger',
      'Havells',
      'Voltas',
      'ABB',
      'Siemens',
      'Cummins',
      'Bosch',
      'MRF',
      'Persistent',
      'Coforge',
      'LTIMindtree',
      'Mphasis',
      'Max Health',
      'Fortis',
      'Zomato',
      'Paytm',
      'Info Edge',
      'Naukri',
      'PB Fintech',
      'Dmart',
    ];

    for (const line of lines) {
      // Skip header lines and short lines
      if (line.length < 5) continue;
      if (/^(top|holdings|sector|allocation|fund|scheme|nav|aum)/i.test(line))
        continue;

      // Try each pattern
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match && holdings.length < 15) {
          const company = match[1].trim();
          const percentage = parseFloat(match[2]);

          // Validate: percentage should be reasonable (0.1% to 15%)
          if (percentage >= 0.1 && percentage <= 15 && company.length > 2) {
            // Check if it looks like a stock name
            const isStock =
              knownStocks.some((s) =>
                company.toLowerCase().includes(s.toLowerCase())
              ) || /^[A-Z][a-z]/.test(company);

            if (isStock) {
              holdings.push({
                company: company,
                percentage: percentage,
              });
            }
          }
        }
      }
    }

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    for (const h of holdings) {
      const key = h.company.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(h);
      }
    }

    // Sort by percentage descending
    unique.sort((a, b) => b.percentage - a.percentage);

    return unique.slice(0, 10); // Return top 10
  } catch (error) {
    console.error(`Error parsing ${pdfPath}:`, error.message);
    return [];
  }
}

/**
 * Extract text from PDF for debugging
 */
async function extractText(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse(buffer);
  const data = await parser.parse();

  let text = '';
  for (const page of data.pages) {
    text += page.text + '\n';
  }
  return text;
}

module.exports = { parseHoldings, extractText };

// If run directly, test with available PDFs
if (require.main === module) {
  const folder = path.join(__dirname, '..', '..', 'data', 'factsheets');

  async function test() {
    const files = fs.readdirSync(folder).filter((f) => f.endsWith('.pdf'));

    console.log('🔍 Extracting holdings from PDFs...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const file of files) {
      const pdfPath = path.join(folder, file);
      console.log(`📄 ${file}:`);

      const holdings = await parseHoldings(pdfPath);

      if (holdings.length > 0) {
        holdings.forEach((h, i) => {
          console.log(`   ${i + 1}. ${h.company} - ${h.percentage}%`);
        });
      } else {
        console.log('   No holdings extracted (PDF format may differ)');

        // Show sample text for debugging
        const text = await extractText(pdfPath);
        const sample = text.substring(0, 500).replace(/\s+/g, ' ');
        console.log(`   Sample text: ${sample}...`);
      }
      console.log('');
    }
  }

  test().catch(console.error);
}
