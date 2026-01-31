import { Request, Response } from 'express';
import { z } from 'zod';
import { FundModel } from '../models/Fund.model';
import { FundManagerModel } from '../models/FundManager.model';
import { formatResponse } from '../utils/response';

const searchFundsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().min(1).max(50).default(10),
});

/**
 * GET /funds/search
 * Search funds by name with autocomplete suggestions
 * Searches across ALL funds in the database - starts matching from beginning
 * Example: if user types "nip", returns all funds starting with "nip" (Nippon, etc.)
 */
export const searchFunds = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { query, limit } = searchFundsSchema.parse(req.query);
    console.log('🔍 Search funds request:', { query, limit });

    const fundModel = FundModel.getInstance();
    const collection = fundModel['collection']; // Access private collection

    // Perform comprehensive text search for fund names
    // Using ^query for starts-with matching + case-insensitive for better UX
    const funds = await collection
      .find({
        $or: [
          { name: { $regex: `^${query}`, $options: 'i' } }, // Starts with (highest priority)
          { name: { $regex: query, $options: 'i' } }, // Contains
          { fundHouse: { $regex: query, $options: 'i' } }, // Fund house match
          { category: { $regex: query, $options: 'i' } }, // Category match
          { subCategory: { $regex: query, $options: 'i' } }, // SubCategory match
        ],
        isActive: true,
      })
      .limit(limit)
      .sort({ popularity: -1, aum: -1 })
      .toArray();

    console.log('✅ Found', funds.length, 'funds matching:', query);

    // Transform results for autocomplete
    const suggestions = funds.map((fund) => {
      // Handle fundManager being either string or object
      let managerName = 'N/A';
      if (typeof fund.fundManager === 'string') {
        managerName = fund.fundManager;
      } else if (
        fund.fundManager &&
        typeof fund.fundManager === 'object' &&
        'name' in fund.fundManager
      ) {
        managerName = (fund.fundManager as any).name;
      }

      return {
        fundId: fund.fundId,
        id: fund._id,
        name: fund.name,
        fundHouse: fund.fundHouse,
        category: fund.category,
        subCategory: fund.subCategory,
        fundManager: managerName,
        fundManagerId: fund.fundManagerId,
        aum: fund.aum,
        returns: {
          oneYear: fund.returns?.oneYear || 0,
          threeYear: fund.returns?.threeYear || 0,
          fiveYear: fund.returns?.fiveYear || 0,
        },
        currentNav: fund.currentNav || 0,
        expenseRatio: fund.expenseRatio || 0,
      };
    });

    return res.json(
      formatResponse(suggestions, 'Fund search results retrieved successfully')
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors);
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('❌ Search funds error:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error', message: String(error) });
  }
};

/**
 * GET /funds/:fundId/manager
 * Get fund manager details for a specific fund
 */
export const getFundManagerByFundId = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { fundId } = req.params;
    console.log('📥 Get fund manager for fund:', fundId);

    const fundModel = FundModel.getInstance();
    const fund = await fundModel.findById(fundId);

    if (!fund) {
      return res.status(404).json({ error: 'Fund not found' });
    }

    // Check if fund has fundManagerDetails (new structure)
    if ((fund as any).fundManagerDetails) {
      const managerDetails = (fund as any).fundManagerDetails;
      console.log('✅ Using fundManagerDetails data:', managerDetails.name);

      // Return manager details in expected format
      const formattedManager = {
        id: null,
        managerId: null,
        name: managerDetails.name || 'N/A',
        bio: managerDetails.bio || 'No bio available',
        experience: managerDetails.experience || 0,
        qualification: managerDetails.qualification || [],
        currentFundHouse: managerDetails.fundHouse || fund.fundHouse,
        designation: managerDetails.designation || 'Fund Manager',
        specialization: managerDetails.specialization || null,
        awards: managerDetails.awards || [],
        notableAchievements: managerDetails.notableAchievements || null,
        isVerified: managerDetails.isVerified || false,
        joinedDate: null,
        fundsManaged: 1,
        fundsList: [
          {
            fundId: fund.fundId,
            fundName: fund.name,
            aum: fund.aum,
            returns: fund.returns,
          },
        ],
        totalAumManaged: fund.aum,
        averageReturns: fund.returns,
        email: null,
        linkedin: null,
        twitter: null,
        isActive: true,
        lastUpdated: managerDetails.lastUpdated || new Date(),
      };

      return res.json(
        formatResponse(
          {
            fund: {
              fundId: fund.fundId,
              name: fund.name,
              category: fund.category,
              fundHouse: fund.fundHouse,
            },
            manager: formattedManager,
          },
          'Fund manager details retrieved successfully'
        )
      );
    }

    // Check if fund has embedded manager object (old structure)
    if (
      fund.fundManager &&
      typeof fund.fundManager === 'object' &&
      fund.fundManager !== null &&
      typeof (fund.fundManager as any).name !== 'undefined'
    ) {
      console.log(
        '✅ Using embedded fund manager data:',
        (fund.fundManager as any).name
      );

      // Return embedded manager data directly
      const embeddedManager = fund.fundManager as any;
      const managerDetails = {
        id: null, // No separate manager document
        managerId: null,
        name: embeddedManager.name || 'N/A',
        bio: embeddedManager.bio || 'No bio available',
        experience: embeddedManager.experience || 0,
        qualification: embeddedManager.qualification || [],
        currentFundHouse: fund.fundHouse,
        designation: embeddedManager.designation || 'Fund Manager',
        joinedDate: null,
        fundsManaged: 1,
        fundsList: [
          {
            fundId: fund.fundId,
            fundName: fund.name,
            aum: fund.aum,
            returns: fund.returns,
          },
        ],
        totalAumManaged: fund.aum,
        averageReturns: fund.returns,
        awards: [],
        email: null,
        linkedin: null,
        twitter: null,
        isActive: true,
        lastUpdated: new Date(),
      };

      return res.json(
        formatResponse(
          {
            fund: {
              fundId: fund.fundId,
              name: fund.name,
              category: fund.category,
              fundHouse: fund.fundHouse,
            },
            manager: managerDetails,
          },
          'Fund manager details retrieved successfully (embedded data)'
        )
      );
    }

    // Get fund manager details from fundManagers collection
    const fundManagerModel = FundManagerModel.getInstance();
    let manager = null;

    if (fund.fundManagerId) {
      manager = await fundManagerModel.findById(fund.fundManagerId);
    }

    // If manager not found by ID, try to find by name
    if (!manager && fund.fundManager && typeof fund.fundManager === 'string') {
      const managers = await fundManagerModel.findAll({ limit: 1000 });
      manager = managers.find(
        (m: any) =>
          m.name.toLowerCase() === fund.fundManager.toLowerCase() ||
          m.fundsManaged?.some(
            (f: any) =>
              (typeof f.fundName === 'string' &&
                f.fundName.toLowerCase() === fund.name.toLowerCase()) ||
              f.fundId === fund.fundId
          )
      );
    }

    if (!manager) {
      return res.status(404).json({
        error: 'Fund manager not found for this fund',
        fundInfo: {
          fundId: fund.fundId,
          name: fund.name,
          fundManager: fund.fundManager,
          fundHouse: fund.fundHouse,
        },
      });
    }

    // Transform fund manager data
    const managerDetails = {
      id: manager._id || manager.managerId,
      managerId: manager.managerId,
      name: manager.name,
      bio: manager.bio,
      experience: manager.experience,
      qualification: manager.qualification,
      currentFundHouse: manager.currentFundHouse,
      designation: manager.designation,
      joinedDate: manager.joinedDate,
      fundsManaged: manager.fundsManaged?.length || 0,
      fundsList:
        manager.fundsManaged?.map((f: any) => ({
          fundId: f.fundId,
          fundName: f.fundName,
          startDate: f.startDate,
          endDate: f.endDate,
          aum: f.aum,
          returns: f.returns,
        })) || [],
      totalAumManaged: manager.totalAumManaged,
      averageReturns: manager.averageReturns,
      awards: manager.awards,
      email: manager.email,
      linkedin: manager.linkedin,
      twitter: manager.twitter,
      isActive: manager.isActive,
      lastUpdated: manager.lastUpdated,
    };

    console.log('✅ Fund manager found:', manager.name);

    return res.json(
      formatResponse(
        {
          fund: {
            fundId: fund.fundId,
            name: fund.name,
            category: fund.category,
            fundHouse: fund.fundHouse,
          },
          manager: managerDetails,
        },
        'Fund manager details retrieved successfully'
      )
    );
  } catch (error) {
    console.error('❌ Get fund manager by fund ID error:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error', message: String(error) });
  }
};
