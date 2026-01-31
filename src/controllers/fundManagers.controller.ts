import { Request, Response } from 'express';
import { z } from 'zod';
import { FundManagerModel } from '../models/FundManager.model';
import {
  formatResponse,
  formatPaginatedResponse,
  pagination,
} from '../utils/response';

const getFundManagersSchema = z.object({
  fundHouse: z.string().optional(),
  minExperience: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['name', 'aum', 'experience']).optional().default('aum'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /fund-managers
 * Get all fund managers with optional filters
 */
export const getFundManagers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    console.log('📥 GET /fund-managers request received');
    const { fundHouse, minExperience, sortBy, page, limit } =
      getFundManagersSchema.parse(req.query);

    console.log('✅ Request params validated:', {
      fundHouse,
      minExperience,
      sortBy,
      page,
      limit,
    });

    const { skip, take } = pagination(page, limit);
    const fundManagerModel = FundManagerModel.getInstance();

    let managers: any[];

    if (fundHouse) {
      managers = await fundManagerModel.findByFundHouse(fundHouse);
    } else if (minExperience) {
      managers = await fundManagerModel.findByExperience(minExperience);
    } else {
      managers = await fundManagerModel.findAll({
        limit: take,
        skip,
        sortBy,
      });
    }

    // Transform data for frontend
    const transformedManagers = managers.map((manager) => ({
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
          aum: f.aum,
          returns: f.returns,
        })) || [],
      totalAumManaged: manager.totalAumManaged,
      averageReturns: manager.averageReturns,
      awards: manager.awards,
      isActive: manager.isActive,
      lastUpdated: manager.lastUpdated,
    }));

    console.log('✅ Fund managers retrieved:', transformedManagers.length);

    const response = formatPaginatedResponse(
      transformedManagers,
      transformedManagers.length,
      page,
      limit,
      'Fund managers retrieved successfully'
    );

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors);
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('❌ Get fund managers error:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error', message: String(error) });
  }
};

/**
 * GET /fund-managers/:id
 * Get fund manager details by ID
 */
export const getFundManagerById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;
    console.log('📥 GET /fund-managers/:id request received for id:', id);

    const fundManagerModel = FundManagerModel.getInstance();

    // Try to find by managerId first, then by MongoDB _id
    let manager = await fundManagerModel.findById(id);
    if (!manager) {
      manager = await fundManagerModel.findByMongoId(id);
    }

    if (!manager) {
      console.log('❌ Fund manager not found:', id);
      return res.status(404).json({ error: 'Fund manager not found' });
    }

    // Transform data for frontend
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
      createdAt: manager.createdAt,
      lastUpdated: manager.lastUpdated,
    };

    console.log('✅ Fund manager details retrieved:', manager.name);

    const response = formatResponse(
      managerDetails,
      'Fund manager details retrieved successfully'
    );
    return res.json(response);
  } catch (error) {
    console.error('❌ Get fund manager by ID error:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error', message: String(error) });
  }
};
