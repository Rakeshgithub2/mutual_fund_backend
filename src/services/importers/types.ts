/**
 * Common types for data importers
 */

export interface RawFundData {
  // AMFI fields
  schemeCode?: string;
  isinDiv?: string;
  isinGrowth?: string;
  schemeName?: string;
  nav?: string;
  date?: string;
  fundHouse?: string;
  schemeType?: string;

  // Generic fields
  symbol?: string;
  name?: string;
  category?: string;
  subCategory?: string;
  currentNav?: number;
  previousNav?: number;
  aum?: number;
  expenseRatio?: number;
  exitLoad?: number;
  minInvestment?: number;
  sipMinAmount?: number;
  launchDate?: Date;
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
  fundManager?: string;
  fundType?: 'mutual_fund' | 'etf';
  dataSource?: string;
}

export interface RawManagerData {
  name: string;
  fundHouse: string;
  designation?: string;
  experience?: number;
  qualification?: string[];
  bio?: string;
  fundsManaged?: Array<{
    fundName: string;
    fundId: string;
  }>;
}

export interface RawPriceData {
  symbol: string;
  date: Date;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  data: any[];
  fundsAdded?: number;
  fundsUpdated?: number;
  fundsSkipped?: number;
}

export interface ImportOptions {
  limit?: number;
  skipExisting?: boolean;
  updateExisting?: boolean;
  dryRun?: boolean;
  onlyFromAMCs?: string[];
  skipValidation?: boolean;
  enforceSEBICategories?: boolean;
}
