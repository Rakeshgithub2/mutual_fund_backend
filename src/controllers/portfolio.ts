import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { formatResponse } from '../utils/response';

const createPortfolioSchema = z.object({
  name: z.string().min(1).max(100),
});

const updatePortfolioSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// Get all portfolios for logged-in user
export const getPortfolios = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId: req.user!.id },
      include: {
        items: {
          include: {
            fund: {
              include: {
                performances: {
                  orderBy: { date: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate current values for each portfolio
    const portfoliosWithValues = await Promise.all(
      portfolios.map(async (portfolio) => {
        let totalInvested = 0;
        let totalCurrent = 0;

        const itemsWithValues = portfolio.items.map((item) => {
          const latestNav = item.fund.performances[0]?.nav || 0;
          const currentValue = item.units * latestNav;
          totalInvested += item.investedAmount;
          totalCurrent += currentValue;

          return {
            ...item,
            currentValue,
            returns: currentValue - item.investedAmount,
            returnsPercent:
              item.investedAmount > 0
                ? ((currentValue - item.investedAmount) / item.investedAmount) *
                  100
                : 0,
          };
        });

        return {
          ...portfolio,
          items: itemsWithValues,
          totalInvested,
          totalValue: totalCurrent,
          totalReturns: totalCurrent - totalInvested,
          totalReturnsPercent:
            totalInvested > 0
              ? ((totalCurrent - totalInvested) / totalInvested) * 100
              : 0,
        };
      })
    );

    res.json(
      formatResponse(portfoliosWithValues, 'Portfolios fetched successfully')
    );
  } catch (error) {
    console.error('Get portfolios error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get portfolio by ID
export const getPortfolioById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: {
        items: {
          include: {
            fund: {
              include: {
                performances: {
                  orderBy: { date: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    // Calculate current values
    let totalInvested = 0;
    let totalCurrent = 0;

    const itemsWithValues = portfolio.items.map((item) => {
      const latestNav = item.fund.performances[0]?.nav || 0;
      const currentValue = item.units * latestNav;
      totalInvested += item.investedAmount;
      totalCurrent += currentValue;

      return {
        ...item,
        currentValue,
        returns: currentValue - item.investedAmount,
        returnsPercent:
          item.investedAmount > 0
            ? ((currentValue - item.investedAmount) / item.investedAmount) * 100
            : 0,
      };
    });

    const portfolioWithValues = {
      ...portfolio,
      items: itemsWithValues,
      totalInvested,
      totalValue: totalCurrent,
      totalReturns: totalCurrent - totalInvested,
      totalReturnsPercent:
        totalInvested > 0
          ? ((totalCurrent - totalInvested) / totalInvested) * 100
          : 0,
    };

    res.json(
      formatResponse(portfolioWithValues, 'Portfolio fetched successfully')
    );
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new portfolio
export const createPortfolio = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const validatedData = createPortfolioSchema.parse(req.body);

    const portfolio = await prisma.portfolio.create({
      data: {
        userId: req.user!.id,
        name: validatedData.name,
      },
    });

    res
      .status(201)
      .json(formatResponse(portfolio, 'Portfolio created successfully', 201));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    console.error('Create portfolio error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update portfolio
export const updatePortfolio = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updatePortfolioSchema.parse(req.body);

    // Check if portfolio exists and belongs to user
    const existingPortfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!existingPortfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    const updateData: any = {};
    if (validatedData.name) updateData.name = validatedData.name;

    const portfolio = await prisma.portfolio.update({
      where: { id },
      data: updateData,
    });

    res.json(formatResponse(portfolio, 'Portfolio updated successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    console.error('Update portfolio error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete portfolio
export const deletePortfolio = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if portfolio exists and belongs to user
    const existingPortfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!existingPortfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }

    await prisma.portfolio.delete({
      where: { id },
    });

    res.json(formatResponse(null, 'Portfolio deleted successfully'));
  } catch (error) {
    console.error('Delete portfolio error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get portfolio summary (aggregated data)
export const getPortfolioSummary = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Get all portfolios with items
    const portfolios = await prisma.portfolio.findMany({
      where: { userId: req.user!.id },
      include: {
        items: {
          include: {
            fund: {
              include: {
                performances: {
                  orderBy: { date: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    let totalInvested = 0;
    let totalCurrent = 0;
    const categoryAllocation: { [key: string]: number } = {};
    const holdings: any[] = [];

    portfolios.forEach((portfolio) => {
      portfolio.items.forEach((item) => {
        const latestNav = item.fund.performances[0]?.nav || 0;
        const currentValue = item.units * latestNav;

        totalInvested += item.investedAmount;
        totalCurrent += currentValue;

        // Category allocation
        const category = item.fund.category || 'OTHER';
        categoryAllocation[category] =
          (categoryAllocation[category] || 0) + currentValue;

        // Add to holdings
        holdings.push({
          id: item.id,
          fundId: item.fundId,
          fundName: item.fund.name,
          category: item.fund.category,
          subCategory: item.fund.subCategory,
          units: item.units,
          nav: latestNav,
          invested: item.investedAmount,
          current: currentValue,
          returns: currentValue - item.investedAmount,
          returnsPercent:
            item.investedAmount > 0
              ? ((currentValue - item.investedAmount) / item.investedAmount) *
                100
              : 0,
        });
      });
    });

    // Calculate allocation percentages
    const allocation = Object.entries(categoryAllocation).map(
      ([category, value]) => ({
        category,
        value,
        percentage: totalCurrent > 0 ? (value / totalCurrent) * 100 : 0,
      })
    );

    const summary = {
      totalValue: totalCurrent,
      totalInvested,
      totalReturns: totalCurrent - totalInvested,
      totalReturnsPercent:
        totalInvested > 0
          ? ((totalCurrent - totalInvested) / totalInvested) * 100
          : 0,
      portfolioCount: portfolios.length,
      holdingsCount: holdings.length,
      allocation,
      holdings: holdings.sort((a, b) => b.current - a.current), // Sort by value
    };

    res.json(formatResponse(summary, 'Portfolio summary fetched successfully'));
  } catch (error) {
    console.error('Get portfolio summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
