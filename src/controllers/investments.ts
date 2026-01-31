import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { formatResponse } from '../utils/response';
import {
  sendInvestmentConfirmation,
  sendSIPConfirmation,
  sendInvestmentFailure,
} from '../services/investmentEmailService';

const createInvestmentSchema = z.object({
  fundId: z.string().min(1),
  type: z.enum(['LUMPSUM', 'SIP']),
  amount: z.number().min(500),
  paymentMethod: z.enum(['UPI', 'NETBANKING', 'DEBIT', 'WALLET', 'AUTOPAY']),
  sipDate: z.number().min(1).max(28).optional(),
  sipFrequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY']).optional(),
});

// Get all investments for logged-in user
export const getInvestments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { status, type } = req.query;

    const whereClause: any = { userId: req.user!.id };
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;

    const investments = await prisma.investment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.json(formatResponse(investments, 'Investments fetched successfully'));
  } catch (error) {
    console.error('Get investments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get investment by ID
export const getInvestmentById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const investment = await prisma.investment.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!investment) {
      res.status(404).json({ error: 'Investment not found' });
      return;
    }

    res.json(formatResponse(investment, 'Investment fetched successfully'));
  } catch (error) {
    console.error('Get investment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new investment
export const createInvestment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const validatedData = createInvestmentSchema.parse(req.body);

    // Check if fund exists
    const fund = await prisma.fund.findUnique({
      where: { id: validatedData.fundId },
      include: {
        performances: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    if (!fund) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }

    // Get latest NAV
    const latestNav = fund.performances[0]?.nav;
    if (!latestNav) {
      res.status(400).json({ error: 'NAV data not available for this fund' });
      return;
    }

    // Calculate units
    const units = validatedData.amount / latestNav;

    // Validate SIP data
    if (validatedData.type === 'SIP') {
      if (!validatedData.sipDate || !validatedData.sipFrequency) {
        res.status(400).json({
          error: 'SIP date and frequency are required for SIP investments',
        });
        return;
      }
    }

    // Create investment
    const investment = await prisma.investment.create({
      data: {
        userId: req.user!.id,
        fundId: validatedData.fundId,
        type: validatedData.type,
        amount: validatedData.amount,
        units,
        nav: latestNav,
        status: 'COMPLETED', // In real app, this would be PENDING until payment confirmed
        paymentMethod: validatedData.paymentMethod,
        sipDate: validatedData.sipDate ?? null,
        sipFrequency: validatedData.sipFrequency ?? null,
        transactionId: `TXN${Date.now()}`, // Generate proper transaction ID
      },
    });

    // Get user's default portfolio or create one
    let portfolio = await prisma.portfolio.findFirst({
      where: { userId: req.user!.id },
    });

    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: {
          userId: req.user!.id,
          name: 'My Portfolio',
        },
      });
    }

    // Check if fund already exists in portfolio
    const existingItem = await prisma.portfolioItem.findFirst({
      where: {
        portfolioId: portfolio.id,
        fundId: validatedData.fundId,
      },
    });

    if (existingItem) {
      // Update existing portfolio item
      await prisma.portfolioItem.update({
        where: { id: existingItem.id },
        data: {
          units: existingItem.units + units,
          investedAmount: existingItem.investedAmount + validatedData.amount,
          currentValue: (existingItem.units + units) * latestNav,
        },
      });
    } else {
      // Create new portfolio item
      await prisma.portfolioItem.create({
        data: {
          portfolioId: portfolio.id,
          fundId: validatedData.fundId,
          units,
          investedAmount: validatedData.amount,
          currentValue: validatedData.amount,
        },
      });
    }

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        fundId: validatedData.fundId,
        type: validatedData.type === 'SIP' ? 'SIP' : 'INVESTMENT',
        amount: validatedData.amount,
        units,
        nav: latestNav,
        status: 'SUCCESS',
        description: `${validatedData.type} investment in ${fund.name}`,
        referenceId: investment.id,
      },
    });

    // Get user details for email
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    // Send confirmation email
    try {
      if (validatedData.type === 'SIP') {
        await sendSIPConfirmation(user!.email, user!.name, {
          fundName: fund.name,
          amount: validatedData.amount,
          sipDate: validatedData.sipDate!,
          frequency: validatedData.sipFrequency!,
          units,
          nav: latestNav,
          transactionId: investment.transactionId!,
        });
      } else {
        await sendInvestmentConfirmation(user!.email, user!.name, {
          fundName: fund.name,
          amount: validatedData.amount,
          units,
          nav: latestNav,
          transactionId: investment.transactionId!,
        });
      }
    } catch (emailError) {
      console.error(
        'Failed to send investment confirmation email:',
        emailError
      );
      // Don't fail the investment if email fails
    }

    res.status(201).json(
      formatResponse(
        {
          investment,
          fund: {
            id: fund.id,
            name: fund.name,
          },
          portfolio: {
            id: portfolio.id,
            name: portfolio.name,
          },
        },
        'Investment created successfully',
        201
      )
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    console.error('Create investment error:', error);

    // Send failure email
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (user) {
        await sendInvestmentFailure(
          user.email,
          user.name,
          'Technical error occurred. Please try again.'
        );
      }
    } catch (emailError) {
      console.error('Failed to send failure email:', emailError);
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

// Cancel investment (only for SIP or pending investments)
export const cancelInvestment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const investment = await prisma.investment.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!investment) {
      res.status(404).json({ error: 'Investment not found' });
      return;
    }

    if (investment.status === 'CANCELLED') {
      res.status(400).json({ error: 'Investment already cancelled' });
      return;
    }

    if (investment.status === 'COMPLETED' && investment.type === 'LUMPSUM') {
      res.status(400).json({
        error: 'Cannot cancel completed lumpsum investment',
      });
      return;
    }

    await prisma.investment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json(formatResponse(null, 'Investment cancelled successfully'));
  } catch (error) {
    console.error('Cancel investment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get investment statistics
export const getInvestmentStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const investments = await prisma.investment.findMany({
      where: { userId: req.user!.id },
    });

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user!.id,
        status: 'SUCCESS',
      },
    });

    const totalInvested = investments
      .filter((inv) => inv.status === 'COMPLETED')
      .reduce((sum, inv) => sum + inv.amount, 0);

    const totalTransactions = transactions.length;

    const sipCount = investments.filter(
      (inv) => inv.type === 'SIP' && inv.status !== 'CANCELLED'
    ).length;

    const lumpsumCount = investments.filter(
      (inv) => inv.type === 'LUMPSUM' && inv.status === 'COMPLETED'
    ).length;

    const stats = {
      totalInvested,
      totalTransactions,
      activeSIPs: sipCount,
      completedInvestments: lumpsumCount,
      pendingInvestments: investments.filter((inv) => inv.status === 'PENDING')
        .length,
    };

    res.json(
      formatResponse(stats, 'Investment statistics fetched successfully')
    );
  } catch (error) {
    console.error('Get investment stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
