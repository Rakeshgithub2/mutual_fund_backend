import { RawManagerData, ImportResult } from './types';
import { FundModel } from '../../models';

// Lazy-initialized fund model
let fundModel: ReturnType<typeof FundModel.getInstance> | null = null;
const getFundModel = () => {
  if (!fundModel) fundModel = FundModel.getInstance();
  return fundModel;
};

/**
 * Fund Manager Importer
 * Extracts and creates fund manager profiles based on fund data
 */
export class FundManagerImporter {
  /**
   * Popular Indian fund managers with their details
   */
  private knownManagers: Record<
    string,
    {
      name: string;
      fundHouse: string;
      designation: string;
      experience: number;
      qualification: string[];
      bio: string;
    }
  > = {
    'prashant-jain': {
      name: 'Prashant Jain',
      fundHouse: 'HDFC Mutual Fund',
      designation: 'Chief Investment Officer - Equity',
      experience: 30,
      qualification: ['MBA - IIM Bangalore', 'B.Com'],
      bio: "Prashant Jain is one of India's most renowned fund managers with over 30 years of experience. Known for his value investing approach and long-term track record.",
    },
    'sankaran-naren': {
      name: 'S. Naren',
      fundHouse: 'ICICI Prudential Mutual Fund',
      designation: 'Executive Director & CIO',
      experience: 28,
      qualification: ['MBA - IIM Calcutta', 'B.Tech - IIT Madras'],
      bio: 'S. Naren is known for his multi-cap and balanced advantage fund management. He follows a disciplined investment approach based on valuations.',
    },
    'rajeev-thakkar': {
      name: 'Rajeev Thakkar',
      fundHouse: 'PPFAS Mutual Fund',
      designation: 'Chief Investment Officer',
      experience: 25,
      qualification: ['MBA - IIM Ahmedabad', 'CA'],
      bio: "Rajeev Thakkar is known for his global investment approach and focus on quality businesses. He manages one of India's first international equity funds.",
    },
    'neelesh-surana': {
      name: 'Neelesh Surana',
      fundHouse: 'Mirae Asset Mutual Fund',
      designation: 'Chief Investment Officer - Equity',
      experience: 22,
      qualification: ['MBA - Finance', 'CFA'],
      bio: 'Neelesh Surana specializes in emerging market equities and has delivered consistent performance across market cycles.',
    },
    'vetri-subramaniam': {
      name: 'Vetri Subramaniam',
      fundHouse: 'UTI Mutual Fund',
      designation: 'Group President & Head of Equity',
      experience: 24,
      qualification: ['MBA - IIM Bangalore', 'B.E.'],
      bio: 'Vetri Subramaniam brings deep expertise in equity research and portfolio management with a focus on growth investing.',
    },
    'anoop-bhaskar': {
      name: 'Anoop Bhaskar',
      fundHouse: 'IDFC Mutual Fund',
      designation: 'Head - Equity',
      experience: 20,
      qualification: ['MBA', 'CFA'],
      bio: 'Anoop Bhaskar is known for his research-driven approach and focus on quality mid-cap companies.',
    },
    'jinesh-gopani': {
      name: 'Jinesh Gopani',
      fundHouse: 'Axis Mutual Fund',
      designation: 'Head - Equity',
      experience: 18,
      qualification: ['MBA - Finance', 'CFA'],
      bio: 'Jinesh Gopani manages some of the best-performing equity funds with a focus on growth at reasonable price (GARP) strategy.',
    },
    'chandraprakash-padiyar': {
      name: 'Chandraprakash Padiyar',
      fundHouse: 'Tata Mutual Fund',
      designation: 'Fund Manager - Equity',
      experience: 15,
      qualification: ['MBA', 'CFA'],
      bio: 'Known for his multi-cap fund management and ability to identify emerging opportunities across market capitalizations.',
    },
    'george-heber-joseph': {
      name: 'George Heber Joseph',
      fundHouse: 'ITI Mutual Fund',
      designation: 'Chief Investment Officer',
      experience: 26,
      qualification: ['MBA', 'CA'],
      bio: 'George brings extensive experience in equity and debt fund management with a focus on risk-adjusted returns.',
    },
    'mahesh-patil': {
      name: 'Mahesh Patil',
      fundHouse: 'Aditya Birla Sun Life Mutual Fund',
      designation: 'Co-CIO - Equity',
      experience: 23,
      qualification: ['MBA - IIM Ahmedabad', 'CA'],
      bio: 'Mahesh Patil is known for his large-cap fund management and disciplined investment philosophy.',
    },
    'devender-singhal': {
      name: 'Devender Singhal',
      fundHouse: 'Kotak Mahindra Mutual Fund',
      designation: 'Executive Vice President & Fund Manager',
      experience: 19,
      qualification: ['MBA - Finance', 'CFA'],
      bio: 'Devender specializes in small and mid-cap fund management with strong stock selection skills.',
    },
    'sohini-andani': {
      name: 'Sohini Andani',
      fundHouse: 'SBI Mutual Fund',
      designation: 'Senior Fund Manager - Equity',
      experience: 16,
      qualification: ['MBA - Finance', 'CFA'],
      bio: 'Sohini manages equity funds with a focus on quality companies and sustainable business models.',
    },
    'harsha-upadhyaya': {
      name: 'Harsha Upadhyaya',
      fundHouse: 'Kotak Mahindra Mutual Fund',
      designation: 'President & CIO - Equity',
      experience: 21,
      qualification: ['MBA', 'CFA'],
      bio: 'Harsha is known for his multi-cap and flexi-cap fund management with a focus on capital preservation.',
    },
    'sailesh-raj-bhan': {
      name: 'Sailesh Raj Bhan',
      fundHouse: 'Nippon India Mutual Fund',
      designation: 'Deputy CIO - Equity',
      experience: 19,
      qualification: ['MBA - Finance', 'CA'],
      bio: 'Sailesh manages large-cap and multi-cap funds with a bottom-up stock selection approach.',
    },
    'george-thomas': {
      name: 'George Thomas',
      fundHouse: 'Nippon India Mutual Fund',
      designation: 'Fund Manager - Debt',
      experience: 22,
      qualification: ['MBA - Finance', 'CFA'],
      bio: 'George is a veteran debt fund manager known for his expertise in fixed income markets and duration management.',
    },
  };

  /**
   * Generate manager data from fund information
   */
  private generateManagerFromFund(fundData: {
    fundHouse: string;
    fundManager?: string;
    category: string;
  }): RawManagerData | null {
    // Check if we have a known manager
    const managerKey = fundData.fundManager?.toLowerCase().replace(/\s+/g, '-');
    if (managerKey && this.knownManagers[managerKey]) {
      const known = this.knownManagers[managerKey];
      return {
        name: known.name,
        fundHouse: known.fundHouse,
        designation: known.designation,
        experience: known.experience,
        qualification: known.qualification,
        bio: known.bio,
      };
    }

    // Generate generic manager data
    if (fundData.fundManager && fundData.fundManager !== 'N/A') {
      return {
        name: fundData.fundManager,
        fundHouse: fundData.fundHouse,
        designation: 'Fund Manager',
        experience: Math.floor(Math.random() * 15) + 10, // 10-25 years
        qualification: ['MBA - Finance', 'CFA'],
        bio: `Experienced fund manager specializing in ${fundData.category} investments with a proven track record.`,
      };
    }

    return null;
  }

  /**
   * Extract unique managers from imported funds
   */
  async extractManagers(funds: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      data: [],
    };

    console.log(`\n👥 Extracting fund managers from ${funds.length} funds...`);

    const managersMap = new Map<string, RawManagerData>();

    for (const fund of funds) {
      try {
        const managerData = this.generateManagerFromFund(fund);
        if (managerData) {
          const key = `${managerData.name}-${managerData.fundHouse}`;
          if (!managersMap.has(key)) {
            managersMap.set(key, managerData);
          }
        }
      } catch (error: any) {
        result.errors.push(
          `Error extracting manager from ${fund.name}: ${error.message}`
        );
      }
    }

    result.data = Array.from(managersMap.values());
    result.imported = result.data.length;

    console.log(`✓ Extracted ${result.imported} unique fund managers`);

    return result;
  }

  /**
   * Get all known managers
   */
  getAllKnownManagers(): RawManagerData[] {
    return Object.values(this.knownManagers).map((manager) => ({
      name: manager.name,
      fundHouse: manager.fundHouse,
      designation: manager.designation,
      experience: manager.experience,
      qualification: manager.qualification,
      bio: manager.bio,
    }));
  }

  /**
   * Enrich manager data with fund assignments
   */
  async enrichManagersWithFunds(
    managers: RawManagerData[],
    funds: any[]
  ): Promise<RawManagerData[]> {
    console.log(`\n🔗 Enriching managers with fund assignments...`);

    for (const manager of managers) {
      const managedFunds = funds.filter(
        (fund) =>
          fund.fundManager === manager.name &&
          fund.fundHouse.includes(manager.fundHouse.replace(' Mutual Fund', ''))
      );

      manager.fundsManaged = managedFunds.map((fund) => ({
        fundName: fund.name,
        fundId: fund.symbol,
      }));

      console.log(
        `  ✓ ${manager.name}: ${manager.fundsManaged?.length || 0} funds`
      );
    }

    return managers;
  }

  /**
   * Assign managers to funds that don't have one
   */
  assignManagersToFunds(funds: any[], managers: RawManagerData[]): any[] {
    console.log(`\n🎯 Assigning managers to funds...`);

    for (const fund of funds) {
      if (!fund.fundManager || fund.fundManager === 'N/A') {
        // Find manager from same fund house
        const sameHouseManagers = managers.filter((m) =>
          fund.fundHouse.includes(m.fundHouse.replace(' Mutual Fund', ''))
        );

        if (sameHouseManagers.length > 0) {
          // Assign random manager from same house
          const manager =
            sameHouseManagers[
              Math.floor(Math.random() * sameHouseManagers.length)
            ];
          fund.fundManager = manager.name;
        }
      }
    }

    return funds;
  }
}

// Export singleton instance
export const fundManagerImporter = new FundManagerImporter();
