import { Router, Request, Response } from 'express';

const router = Router();
const portfolioService = require('../../services/portfolioService');

/**
 * @route   GET /api/portfolio/:userId
 * @desc    Get user portfolio (creates empty one if doesn't exist)
 * @access  Public
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const portfolio = await portfolioService.getUserPortfolio(userId);

    res.json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/portfolio/:userId/summary
 * @desc    Get portfolio summary with statistics
 * @access  Public
 */
router.get('/:userId/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const summary = await portfolioService.getPortfolioSummary(userId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching portfolio summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio summary',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /api/portfolio/:userId/transactions
 * @desc    Get transaction history
 * @access  Public
 */
router.get('/:userId/transactions', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const history = await portfolioService.getTransactionHistory(
      userId,
      limit ? parseInt(limit as string) : 50
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /api/portfolio/:userId/transaction
 * @desc    Add a buy or sell transaction
 * @access  Public
 * @body    { type: 'buy' | 'sell', fundId: string, units: number, price: number, date?: Date }
 */
router.post('/:userId/transaction', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const transaction = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (
      !transaction.type ||
      !transaction.fundId ||
      !transaction.units ||
      !transaction.price
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required transaction fields: type, fundId, units, price',
      });
    }

    const result = await portfolioService.addTransaction(userId, transaction);

    res.json({
      success: true,
      message: `${transaction.type === 'buy' ? 'Purchase' : 'Sale'} completed successfully`,
      data: result,
    });
  } catch (error) {
    console.error('Error adding transaction:', error);
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : 'Failed to add transaction',
    });
  }
});

/**
 * @route   PUT /api/portfolio/:userId/update
 * @desc    Update portfolio values based on latest NAVs
 * @access  Public
 */
router.put('/:userId/update', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const portfolio = await portfolioService.updatePortfolioValues(userId);

    res.json({
      success: true,
      message: 'Portfolio values updated successfully',
      data: portfolio,
    });
  } catch (error) {
    console.error('Error updating portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update portfolio values',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
