import { Router, Request, Response } from 'express';
import { formatResponse } from '../utils/response';

const router = Router();

// SIP Calculator - Calculate future value of SIP investment
router.post('/sip', async (req: Request, res: Response) => {
  try {
    const { monthlyInvestment, expectedReturn, timePeriod } = req.body;

    // Validate inputs
    if (!monthlyInvestment || !expectedReturn || !timePeriod) {
      return res.status(400).json({
        statusCode: 400,
        message:
          'Missing required fields: monthlyInvestment, expectedReturn, timePeriod',
      });
    }

    const P = parseFloat(monthlyInvestment);
    const r = parseFloat(expectedReturn) / 100 / 12; // Monthly rate
    const n = parseInt(timePeriod) * 12; // Total months

    // Future Value = P × [((1 + r)^n - 1) / r] × (1 + r)
    const futureValue = P * (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
    const totalInvestment = P * n;
    const estimatedReturns = futureValue - totalInvestment;

    return res.json(
      formatResponse(
        {
          monthlyInvestment: P,
          timePeriod: parseInt(timePeriod),
          expectedReturn: parseFloat(expectedReturn),
          totalInvestment: Math.round(totalInvestment),
          estimatedReturns: Math.round(estimatedReturns),
          futureValue: Math.round(futureValue),
          calculation: {
            formula: 'P × [((1 + r)^n - 1) / r] × (1 + r)',
            breakdown: {
              principal: P,
              monthlyRate: r.toFixed(6),
              totalMonths: n,
            },
          },
        },
        'SIP calculation completed'
      )
    );
  } catch (error) {
    console.error('SIP calculation error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to calculate SIP',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Lumpsum Calculator - Calculate future value of one-time investment
router.post('/lumpsum', async (req: Request, res: Response) => {
  try {
    const { investment, expectedReturn, timePeriod } = req.body;

    if (!investment || !expectedReturn || !timePeriod) {
      return res.status(400).json({
        statusCode: 400,
        message:
          'Missing required fields: investment, expectedReturn, timePeriod',
      });
    }

    const P = parseFloat(investment);
    const r = parseFloat(expectedReturn) / 100;
    const t = parseInt(timePeriod);

    // Future Value = P × (1 + r)^t
    const futureValue = P * Math.pow(1 + r, t);
    const estimatedReturns = futureValue - P;

    return res.json(
      formatResponse(
        {
          investment: P,
          timePeriod: t,
          expectedReturn: parseFloat(expectedReturn),
          totalInvestment: P,
          estimatedReturns: Math.round(estimatedReturns),
          futureValue: Math.round(futureValue),
          calculation: {
            formula: 'P × (1 + r)^t',
            breakdown: {
              principal: P,
              annualRate: r,
              years: t,
            },
          },
        },
        'Lumpsum calculation completed'
      )
    );
  } catch (error) {
    console.error('Lumpsum calculation error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to calculate lumpsum',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Goal Planning Calculator - Calculate monthly SIP needed for a goal
router.post('/goal', async (req: Request, res: Response) => {
  try {
    const { targetAmount, timePeriod, expectedReturn, currentSavings } =
      req.body;

    if (!targetAmount || !timePeriod || !expectedReturn) {
      return res.status(400).json({
        statusCode: 400,
        message:
          'Missing required fields: targetAmount, timePeriod, expectedReturn',
      });
    }

    const target = parseFloat(targetAmount);
    const current = parseFloat(currentSavings) || 0;
    const r = parseFloat(expectedReturn) / 100 / 12;
    const n = parseInt(timePeriod) * 12;

    // Adjust target for current savings growth
    const currentValueAtGoal = current * Math.pow(1 + r, n);
    const adjustedTarget = target - currentValueAtGoal;

    // Calculate required monthly SIP
    // P = FV / [((1 + r)^n - 1) / r] / (1 + r)
    let monthlySIP = 0;
    if (adjustedTarget > 0) {
      monthlySIP = adjustedTarget / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
    }

    const totalInvestment = monthlySIP * n + current;
    const estimatedReturns = target - totalInvestment;

    return res.json(
      formatResponse(
        {
          goalName: req.body.goalName || 'Financial Goal',
          targetAmount: target,
          currentSavings: current,
          timePeriod: parseInt(timePeriod),
          expectedReturn: parseFloat(expectedReturn),
          requiredMonthlySIP: Math.round(monthlySIP),
          totalInvestment: Math.round(totalInvestment),
          estimatedReturns: Math.round(estimatedReturns),
          breakdown: {
            currentSavingsGrowth: Math.round(currentValueAtGoal),
            sipContribution: Math.round(monthlySIP * n),
            returnsOnSIP: Math.round(
              target - currentValueAtGoal - monthlySIP * n
            ),
          },
        },
        'Goal planning calculated'
      )
    );
  } catch (error) {
    console.error('Goal calculation error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to calculate goal',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Step-up SIP Calculator - Calculate SIP with annual increase
router.post('/step-up-sip', async (req: Request, res: Response) => {
  try {
    const { initialSIP, stepUpPercentage, expectedReturn, timePeriod } =
      req.body;

    if (!initialSIP || !stepUpPercentage || !expectedReturn || !timePeriod) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Missing required fields',
      });
    }

    const P = parseFloat(initialSIP);
    const stepUp = parseFloat(stepUpPercentage) / 100;
    const r = parseFloat(expectedReturn) / 100 / 12;
    const years = parseInt(timePeriod);

    let futureValue = 0;
    let totalInvestment = 0;
    let currentSIP = P;

    for (let year = 0; year < years; year++) {
      for (let month = 0; month < 12; month++) {
        const remainingMonths = (years - year) * 12 - month;
        futureValue += currentSIP * Math.pow(1 + r, remainingMonths);
        totalInvestment += currentSIP;
      }
      currentSIP = currentSIP * (1 + stepUp);
    }

    const estimatedReturns = futureValue - totalInvestment;

    return res.json(
      formatResponse(
        {
          initialSIP: P,
          stepUpPercentage: parseFloat(stepUpPercentage),
          timePeriod: years,
          expectedReturn: parseFloat(expectedReturn),
          finalMonthlySIP: Math.round(currentSIP / (1 + stepUp)),
          totalInvestment: Math.round(totalInvestment),
          estimatedReturns: Math.round(estimatedReturns),
          futureValue: Math.round(futureValue),
        },
        'Step-up SIP calculation completed'
      )
    );
  } catch (error) {
    console.error('Step-up SIP calculation error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to calculate step-up SIP',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Retirement Calculator
router.post('/retirement', async (req: Request, res: Response) => {
  try {
    const {
      currentAge,
      retirementAge,
      currentSavings,
      monthlyExpense,
      expectedReturn,
      inflationRate,
    } = req.body;

    if (!currentAge || !retirementAge || !monthlyExpense) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Missing required fields',
      });
    }

    const yearsToRetirement = parseInt(retirementAge) - parseInt(currentAge);
    const lifeExpectancy = 80; // Assumed
    const yearsInRetirement = lifeExpectancy - parseInt(retirementAge);

    const r = (parseFloat(expectedReturn) || 12) / 100;
    const inflation = (parseFloat(inflationRate) || 6) / 100;
    const current = parseFloat(currentSavings) || 0;
    const monthlyExp = parseFloat(monthlyExpense);

    // Future monthly expense at retirement
    const futureMonthlyExpense =
      monthlyExp * Math.pow(1 + inflation, yearsToRetirement);
    const annualExpenseAtRetirement = futureMonthlyExpense * 12;

    // Corpus needed using 4% withdrawal rule (adjusted for India = 6%)
    const corpusNeeded = annualExpenseAtRetirement / 0.06;

    // Growth of current savings
    const currentSavingsGrowth = current * Math.pow(1 + r, yearsToRetirement);

    // Additional corpus needed
    const additionalCorpus = Math.max(0, corpusNeeded - currentSavingsGrowth);

    // Monthly SIP required
    const monthlyRate = r / 12;
    const n = yearsToRetirement * 12;
    let monthlySIP = 0;
    if (additionalCorpus > 0) {
      monthlySIP =
        additionalCorpus /
        (((Math.pow(1 + monthlyRate, n) - 1) / monthlyRate) *
          (1 + monthlyRate));
    }

    return res.json(
      formatResponse(
        {
          currentAge: parseInt(currentAge),
          retirementAge: parseInt(retirementAge),
          yearsToRetirement,
          currentMonthlyExpense: monthlyExp,
          futureMonthlyExpense: Math.round(futureMonthlyExpense),
          corpusNeeded: Math.round(corpusNeeded),
          currentSavings: current,
          requiredMonthlySIP: Math.round(monthlySIP),
          totalInvestmentNeeded: Math.round(monthlySIP * n + current),
          breakdown: {
            currentSavingsGrowth: Math.round(currentSavingsGrowth),
            additionalCorpusNeeded: Math.round(additionalCorpus),
            yearlyExpenseAtRetirement: Math.round(annualExpenseAtRetirement),
          },
        },
        'Retirement planning calculated'
      )
    );
  } catch (error) {
    console.error('Retirement calculation error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to calculate retirement plan',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
