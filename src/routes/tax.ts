import { Router, Request, Response } from 'express';
import { formatResponse } from '../utils/response';

const router = Router();

// Tax Calculator for Mutual Fund Capital Gains
router.post('/capital-gains', async (req: Request, res: Response) => {
  try {
    const {
      investmentType, // EQUITY or DEBT
      purchasePrice,
      salePrice,
      units,
      purchaseDate,
      saleDate,
      isIndexed, // For LTCG in debt funds (bought before Apr 1, 2023)
    } = req.body;

    if (
      !investmentType ||
      !purchasePrice ||
      !salePrice ||
      !units ||
      !purchaseDate ||
      !saleDate
    ) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Missing required fields',
      });
    }

    const purchase = new Date(purchaseDate);
    const sale = new Date(saleDate);
    const holdingPeriodDays = Math.floor(
      (sale.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24)
    );
    const holdingPeriodMonths = Math.floor(holdingPeriodDays / 30);

    let capitalGain =
      (parseFloat(salePrice) - parseFloat(purchasePrice)) * parseFloat(units);
    let taxRate = 0;
    let taxAmount = 0;
    let gainType = '';
    let exemptionLimit = 0;
    let taxableGain = capitalGain;

    if (investmentType === 'EQUITY') {
      // Equity Funds
      if (holdingPeriodDays >= 365) {
        // Long Term Capital Gains (LTCG)
        gainType = 'Long Term Capital Gains (LTCG)';
        exemptionLimit = 100000; // ₹1 lakh exemption per year
        taxableGain = Math.max(0, capitalGain - exemptionLimit);
        taxRate = 10; // 10% on gains above ₹1 lakh
        taxAmount = taxableGain * 0.1;
      } else {
        // Short Term Capital Gains (STCG)
        gainType = 'Short Term Capital Gains (STCG)';
        taxRate = 15; // 15% flat
        taxAmount = capitalGain * 0.15;
      }
    } else if (investmentType === 'DEBT') {
      // Debt Funds (new rules from Apr 1, 2023)
      const isBoughtBeforeApr2023 = purchase < new Date('2023-04-01');

      if (isBoughtBeforeApr2023 && holdingPeriodDays >= 1095) {
        // Old LTCG rules with indexation
        gainType = 'Long Term Capital Gains (LTCG) - With Indexation';

        if (isIndexed) {
          // Simplified indexation calculation (user should provide indexed cost)
          const indexationBenefit = capitalGain * 0.3; // Assumed 30% indexation benefit
          taxableGain = capitalGain - indexationBenefit;
          taxRate = 20; // 20% with indexation
          taxAmount = taxableGain * 0.2;
        } else {
          taxRate = 20;
          taxAmount = capitalGain * 0.2;
        }
      } else {
        // New rules: Taxed as per income tax slab
        gainType = 'Added to Income (Taxed at your slab rate)';
        taxRate = 0; // Variable - depends on user's tax slab
        taxAmount = 0; // Cannot calculate without knowing user's income
        taxableGain = capitalGain;
      }
    }

    return res.json(
      formatResponse(
        {
          investmentType,
          purchasePrice: parseFloat(purchasePrice),
          salePrice: parseFloat(salePrice),
          units: parseFloat(units),
          holdingPeriod: {
            days: holdingPeriodDays,
            months: holdingPeriodMonths,
            years: (holdingPeriodMonths / 12).toFixed(1),
          },
          capitalGain: Math.round(capitalGain),
          gainType,
          exemptionLimit,
          taxableGain: Math.round(taxableGain),
          taxRate: taxRate > 0 ? `${taxRate}%` : 'As per your tax slab',
          taxAmount: Math.round(taxAmount),
          netGain: Math.round(capitalGain - taxAmount),
          notes:
            investmentType === 'DEBT' && taxRate === 0
              ? 'Debt funds purchased after Apr 1, 2023 are taxed at your income tax slab rate. Please consult a tax advisor for accurate calculation.'
              : undefined,
        },
        'Tax calculation completed'
      )
    );
  } catch (error) {
    console.error('Tax calculation error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to calculate tax',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// SIP Tax Calculator - Calculate tax on multiple SIP installments
router.post('/sip-gains', async (req: Request, res: Response) => {
  try {
    const { installments, salePrice, saleDate, investmentType } = req.body;

    if (
      !Array.isArray(installments) ||
      installments.length === 0 ||
      !salePrice ||
      !saleDate
    ) {
      return res.status(400).json({
        statusCode: 400,
        message:
          'Invalid input. Provide installments array with purchaseDate, units, and nav',
      });
    }

    const sale = new Date(saleDate);
    let totalTax = 0;
    let totalCapitalGain = 0;
    let stcg = 0;
    let ltcg = 0;
    let ltcgExemptionUsed = 0;
    const exemptionLimit = investmentType === 'EQUITY' ? 100000 : 0;

    const installmentTaxes = installments.map((inst: any) => {
      const purchase = new Date(inst.purchaseDate);
      const holdingDays = Math.floor(
        (sale.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24)
      );
      const units = parseFloat(inst.units);
      const purchaseNav = parseFloat(inst.nav);
      const saleNav = parseFloat(salePrice);

      const capitalGain = (saleNav - purchaseNav) * units;
      let tax = 0;
      let isLongTerm = false;

      if (investmentType === 'EQUITY') {
        if (holdingDays >= 365) {
          // LTCG
          isLongTerm = true;
          ltcg += capitalGain;
          const remainingExemption = Math.max(
            0,
            exemptionLimit - ltcgExemptionUsed
          );
          const exemptedAmount = Math.min(capitalGain, remainingExemption);
          ltcgExemptionUsed += exemptedAmount;
          const taxableAmount = capitalGain - exemptedAmount;
          tax = Math.max(0, taxableAmount * 0.1);
        } else {
          // STCG
          stcg += capitalGain;
          tax = capitalGain * 0.15;
        }
      }

      totalCapitalGain += capitalGain;
      totalTax += tax;

      return {
        purchaseDate: inst.purchaseDate,
        units,
        purchaseNav,
        holdingDays,
        capitalGain: Math.round(capitalGain),
        gainType: isLongTerm ? 'LTCG' : 'STCG',
        tax: Math.round(tax),
      };
    });

    return res.json(
      formatResponse(
        {
          investmentType,
          salePrice: parseFloat(salePrice),
          saleDate,
          totalInstallments: installments.length,
          summary: {
            totalCapitalGain: Math.round(totalCapitalGain),
            stcg: Math.round(stcg),
            ltcg: Math.round(ltcg),
            ltcgExemptionUsed: Math.round(ltcgExemptionUsed),
            totalTax: Math.round(totalTax),
            netGain: Math.round(totalCapitalGain - totalTax),
          },
          installmentDetails: installmentTaxes,
        },
        'SIP tax calculation completed'
      )
    );
  } catch (error) {
    console.error('SIP tax calculation error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to calculate SIP tax',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Dividend Tax Calculator
router.post('/dividend', async (req: Request, res: Response) => {
  try {
    const { dividendAmount, taxSlab } = req.body;

    if (!dividendAmount || !taxSlab) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Provide dividendAmount and taxSlab (0, 5, 10, 15, 20, 30)',
      });
    }

    const dividend = parseFloat(dividendAmount);
    const slab = parseInt(taxSlab);

    // TDS is deducted at 10% if dividend > ₹5,000
    const tdsRate = dividend > 5000 ? 10 : 0;
    const tdsAmount = dividend * (tdsRate / 100);

    // Additional tax based on slab
    const totalTax = dividend * (slab / 100);
    const additionalTax = totalTax - tdsAmount;

    return res.json(
      formatResponse(
        {
          dividendAmount: dividend,
          taxSlab: `${slab}%`,
          tds: {
            rate: `${tdsRate}%`,
            amount: Math.round(tdsAmount),
            note: 'TDS is deducted at 10% on dividends exceeding ₹5,000 per year',
          },
          totalTax: Math.round(totalTax),
          additionalTaxPayable: Math.round(Math.max(0, additionalTax)),
          netDividend: Math.round(dividend - totalTax),
        },
        'Dividend tax calculation completed'
      )
    );
  } catch (error) {
    console.error('Dividend tax calculation error:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to calculate dividend tax',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
