/**
 * STEP-4: Sector Mapping Utility
 * Maps company names to their sectors
 */

const sectorPatterns = [
  // Financial Services
  {
    pattern:
      /Bank|HDFC|ICICI|Axis|Kotak|IndusInd|Federal|AU Small|Bajaj Finance|Bajaj Finserv|HDFC Life|SBI Life|ICICI Prudential|Cholamandalam|LIC|M&M Financial|Muthoot|Shriram/i,
    sector: 'Financial Services',
  },

  // Information Technology
  {
    pattern:
      /TCS|Infosys|Wipro|Tech Mahindra|HCL Tech|LTIMindtree|Persistent|Coforge|Mphasis|KPIT|L&T Technology|Cyient|Tata Elxsi|Mindtree|NIIT/i,
    sector: 'Information Technology',
  },

  // Oil & Gas
  {
    pattern:
      /Reliance|ONGC|Oil India|BPCL|HPCL|IOC|Indian Oil|Petronet|GAIL|Adani Total|Hindustan Petroleum|Bharat Petroleum/i,
    sector: 'Oil Gas & Consumable Fuels',
  },

  // FMCG
  {
    pattern:
      /ITC|HUL|Hindustan Unilever|Nestle|Britannia|Dabur|Marico|Godrej Consumer|Colgate|Tata Consumer|Emami|Varun Beverages|United Spirits|United Breweries/i,
    sector: 'Fast Moving Consumer Goods',
  },

  // Pharmaceuticals & Healthcare
  {
    pattern:
      /Sun Pharma|Cipla|Dr Reddy|Divi|Lupin|Aurobindo|Torrent Pharma|Zydus|Alkem|Abbott|Biocon|Gland|Laurus|Apollo Hospital|Max Health|Fortis|Narayana|Metropolis/i,
    sector: 'Healthcare',
  },

  // Automobile
  {
    pattern:
      /Maruti|Tata Motors|Mahindra|M&M|Bajaj Auto|Hero MotoCorp|Eicher|TVS|Ashok Leyland|Tube Investment|Motherson|Bosch|MRF|Apollo Tyres|Balkrishna|Exide/i,
    sector: 'Automobile',
  },

  // Construction & Infrastructure
  {
    pattern:
      /Larsen|L&T|DLF|Godrej Properties|Oberoi|Prestige|Phoenix|Brigade|Sobha|Macrotech|Lodha|IRB|KEC|Kalpataru|NCC|PNC Infratech/i,
    sector: 'Construction',
  },

  // Metals & Mining
  {
    pattern:
      /Tata Steel|JSW Steel|Hindalco|Vedanta|NMDC|Coal India|Jindal Steel|Steel Authority|SAIL|Hindustan Zinc|Hindustan Copper|Nalco/i,
    sector: 'Metals & Mining',
  },

  // Telecom
  {
    pattern:
      /Bharti Airtel|Jio|Vodafone Idea|Indus Towers|Tata Communications|Bharti Hexacom/i,
    sector: 'Telecommunication',
  },

  // Power & Utilities
  {
    pattern:
      /NTPC|Power Grid|Adani Green|Adani Power|Tata Power|JSW Energy|NHPC|SJVN|Torrent Power|CESC/i,
    sector: 'Power',
  },

  // Consumer Durables
  {
    pattern:
      /Asian Paints|Berger|Pidilite|Havells|Voltas|Crompton|Whirlpool|Blue Star|Dixon|Amber|V-Guard|Kajaria|Cera/i,
    sector: 'Consumer Durables',
  },

  // Capital Goods
  {
    pattern:
      /ABB|Siemens|CG Power|Thermax|Cummins|Bharat Forge|Apar Industries|Kaynes|Data Patterns|Carborundum|Praj|KEI|Polycab|Finolex/i,
    sector: 'Capital Goods',
  },

  // Chemicals
  {
    pattern:
      /SRF|Aarti|Navin Fluorine|Deepak Nitrite|PI Industries|Atul|Tata Chemicals|UPL|Balaji Amines|Gujarat Fluorochemicals|Fine Organic/i,
    sector: 'Chemicals',
  },

  // Cement
  {
    pattern:
      /UltraTech|Ambuja|ACC|Shree Cement|Dalmia|Ramco|JK Cement|Birla Corporation|India Cement|Nuvoco/i,
    sector: 'Cement',
  },

  // Insurance
  {
    pattern:
      /LIC|HDFC Life|SBI Life|ICICI Prudential Life|Max Life|General Insurance|New India|Star Health/i,
    sector: 'Insurance',
  },

  // Realty
  {
    pattern:
      /DLF|Godrej Properties|Oberoi Realty|Prestige|Phoenix Mills|Brigade|Sobha|Macrotech|Lodha/i,
    sector: 'Realty',
  },

  // Hotels & Restaurants
  {
    pattern:
      /Indian Hotels|Taj|EIH|Lemon Tree|Chalet|Jubilant Food|Devyani|Sapphire|Westlife/i,
    sector: 'Hotels & Restaurants',
  },

  // Media & Entertainment
  {
    pattern:
      /Zee|Sun TV|PVR|Inox|Network18|TV18|Nazara|Info Edge|Naukri|Zomato|Paytm|PB Fintech/i,
    sector: 'Media & Entertainment',
  },

  // Retail
  {
    pattern:
      /Titan|Avenue|Dmart|Trent|V-Mart|Shoppers Stop|Aditya Birla Fashion|ABFRL/i,
    sector: 'Retail',
  },

  // Government Securities (for debt funds)
  {
    pattern:
      /Government of India|GOI|G-Sec|Treasury|SDL|State Development Loan/i,
    sector: 'Government Securities',
  },

  // Corporate Bonds (for debt funds)
  {
    pattern:
      /NCD|CP|CD|Commercial Paper|Certificate of Deposit|Debenture|Bond/i,
    sector: 'Corporate Bonds',
  },
];

/**
 * Map a company/security name to its sector
 * @param {string} name - Company or security name
 * @returns {string} - Sector name
 */
function sectorMap(name) {
  if (!name) return 'Others';

  for (const { pattern, sector } of sectorPatterns) {
    if (pattern.test(name)) {
      return sector;
    }
  }

  return 'Others';
}

/**
 * Get all available sectors
 * @returns {string[]} - List of sector names
 */
function getAllSectors() {
  const sectors = new Set(sectorPatterns.map((p) => p.sector));
  sectors.add('Others');
  return [...sectors];
}

module.exports = { sectorMap, getAllSectors };
