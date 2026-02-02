"use strict";
/**
 * Calculation Service - Handles all financial calculations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculationService = exports.CalculationService = void 0;
class CalculationService {
    /**
     * Calculate SIP Future Value
     * FV = P × ((1 + r)^n - 1) / r × (1 + r)
     */
    calculateSIP(monthlyInvestment, rateOfReturn, years) {
        const months = years * 12;
        const monthlyRate = rateOfReturn / 12 / 100;
        if (monthlyRate === 0) {
            return monthlyInvestment * months;
        }
        const futureValue = monthlyInvestment *
            (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
                (1 + monthlyRate));
        const totalInvested = monthlyInvestment * months;
        const returns = futureValue - totalInvested;
        return {
            futureValue: Math.round(futureValue),
            totalInvested: Math.round(totalInvested),
            returns: Math.round(returns),
            percentageGain: ((returns / totalInvested) * 100).toFixed(2),
        };
    }
    /**
     * Calculate Lumpsum Future Value
     * FV = P × (1 + r)^n
     */
    calculateLumpsum(principal, rateOfReturn, years) {
        const rate = rateOfReturn / 100;
        const futureValue = principal * Math.pow(1 + rate, years);
        const returns = futureValue - principal;
        return {
            futureValue: Math.round(futureValue),
            totalInvested: principal,
            returns: Math.round(returns),
            percentageGain: ((returns / principal) * 100).toFixed(2),
        };
    }
    /**
     * Calculate CAGR (Compound Annual Growth Rate)
     * CAGR = (Ending Value / Beginning Value)^(1/years) - 1
     */
    calculateCAGR(beginningValue, endingValue, years) {
        const cagr = (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100;
        return {
            cagr: cagr.toFixed(2),
            totalReturn: (((endingValue - beginningValue) / beginningValue) *
                100).toFixed(2),
            absoluteReturn: Math.round(endingValue - beginningValue),
        };
    }
    /**
     * Calculate SWP (Systematic Withdrawal Plan)
     */
    calculateSWP(corpus, monthlyWithdrawal, rateOfReturn, years) {
        const months = years * 12;
        const monthlyRate = rateOfReturn / 12 / 100;
        let remainingCorpus = corpus;
        let totalWithdrawn = 0;
        for (let i = 0; i < months; i++) {
            remainingCorpus = remainingCorpus * (1 + monthlyRate) - monthlyWithdrawal;
            totalWithdrawn += monthlyWithdrawal;
            if (remainingCorpus <= 0) {
                return {
                    remainingCorpus: 0,
                    totalWithdrawn: Math.round(totalWithdrawn),
                    monthsLasted: i + 1,
                    yearsLasted: ((i + 1) / 12).toFixed(2),
                    corpusExhausted: true,
                };
            }
        }
        return {
            remainingCorpus: Math.round(remainingCorpus),
            totalWithdrawn: Math.round(totalWithdrawn),
            monthsLasted: months,
            yearsLasted: years,
            corpusExhausted: false,
        };
    }
    /**
     * Calculate Expense Ratio Impact
     */
    calculateExpenseRatioImpact(investment, returns, expenseRatio, years) {
        const netReturn = returns - expenseRatio;
        const withExpense = investment * Math.pow(1 + netReturn / 100, years);
        const withoutExpense = investment * Math.pow(1 + returns / 100, years);
        const impact = withoutExpense - withExpense;
        return {
            withExpense: Math.round(withExpense),
            withoutExpense: Math.round(withoutExpense),
            expenseImpact: Math.round(impact),
            percentageImpact: ((impact / withoutExpense) * 100).toFixed(2),
        };
    }
    /**
     * Calculate Tax on LTCG (Long Term Capital Gains)
     */
    calculateLTCG(gainAmount) {
        const exemptionLimit = 125000;
        const taxRate = 0.125; // 12.5%
        if (gainAmount <= exemptionLimit) {
            return {
                taxableGain: 0,
                tax: 0,
                postTaxGain: gainAmount,
                effectiveRate: 0,
            };
        }
        const taxableGain = gainAmount - exemptionLimit;
        const tax = taxableGain * taxRate;
        const postTaxGain = gainAmount - tax;
        return {
            taxableGain: Math.round(taxableGain),
            tax: Math.round(tax),
            postTaxGain: Math.round(postTaxGain),
            effectiveRate: ((tax / gainAmount) * 100).toFixed(2),
        };
    }
    /**
     * Calculate Tax on STCG (Short Term Capital Gains)
     */
    calculateSTCG(gainAmount) {
        const taxRate = 0.2; // 20%
        const tax = gainAmount * taxRate;
        const postTaxGain = gainAmount - tax;
        return {
            taxableGain: gainAmount,
            tax: Math.round(tax),
            postTaxGain: Math.round(postTaxGain),
            effectiveRate: (taxRate * 100).toFixed(2),
        };
    }
    /**
     * Calculate Emergency Fund Required
     */
    calculateEmergencyFund(monthlyExpenses, months = 6) {
        const requiredFund = monthlyExpenses * months;
        return {
            requiredFund: Math.round(requiredFund),
            monthsCovered: months,
            monthlyExpenses,
            recommendation: months >= 6 ? 'Adequate' : 'Increase to 6 months',
        };
    }
    /**
     * Calculate Retirement Corpus
     */
    calculateRetirementCorpus(currentAge, retirementAge, monthlyExpenses, inflation = 6, postRetirementReturn = 8) {
        const yearsToRetirement = retirementAge - currentAge;
        const lifeExpectancy = 85;
        const yearsInRetirement = lifeExpectancy - retirementAge;
        // Future monthly expenses at retirement
        const futureMonthlyExpenses = monthlyExpenses * Math.pow(1 + inflation / 100, yearsToRetirement);
        // Corpus required using 4% rule or calculated
        const annualExpenses = futureMonthlyExpenses * 12;
        const corpusRequired = annualExpenses * 25; // 4% rule
        return {
            corpusRequired: Math.round(corpusRequired),
            futureMonthlyExpenses: Math.round(futureMonthlyExpenses),
            yearsToRetirement,
            yearsInRetirement,
            currentAge,
            retirementAge,
        };
    }
    /**
     * Calculate Goal Planning
     */
    calculateGoalPlanning(goalAmount, yearsToGoal, currentSavings = 0, expectedReturn = 12) {
        // Future value of current savings
        const fvCurrentSavings = currentSavings * Math.pow(1 + expectedReturn / 100, yearsToGoal);
        // Additional amount needed
        const additionalNeeded = goalAmount - fvCurrentSavings;
        if (additionalNeeded <= 0) {
            return {
                monthlySIPNeeded: 0,
                lumpSumNeeded: 0,
                currentSavings,
                goalMet: true,
                surplus: Math.round(Math.abs(additionalNeeded)),
            };
        }
        // Calculate monthly SIP needed
        const months = yearsToGoal * 12;
        const monthlyRate = expectedReturn / 12 / 100;
        const monthlySIP = additionalNeeded /
            (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
                (1 + monthlyRate));
        // Calculate lumpsum needed
        const lumpSumNeeded = additionalNeeded / Math.pow(1 + expectedReturn / 100, yearsToGoal);
        return {
            monthlySIPNeeded: Math.round(monthlySIP),
            lumpSumNeeded: Math.round(lumpSumNeeded),
            currentSavings,
            goalMet: false,
            shortfall: Math.round(additionalNeeded),
        };
    }
    /**
     * Calculate NAV returns
     */
    calculateNAVReturns(purchaseNAV, currentNAV, units) {
        const investedAmount = purchaseNAV * units;
        const currentValue = currentNAV * units;
        const returns = currentValue - investedAmount;
        const returnsPercentage = (returns / investedAmount) * 100;
        return {
            investedAmount: Math.round(investedAmount),
            currentValue: Math.round(currentValue),
            returns: Math.round(returns),
            returnsPercentage: returnsPercentage.toFixed(2),
            units,
        };
    }
    /**
     * Calculate Step-up SIP
     */
    calculateStepUpSIP(initialMonthly, annualIncrement, rateOfReturn, years) {
        const monthlyRate = rateOfReturn / 12 / 100;
        let futureValue = 0;
        let totalInvested = 0;
        let monthlyAmount = initialMonthly;
        for (let year = 0; year < years; year++) {
            for (let month = 0; month < 12; month++) {
                futureValue = futureValue * (1 + monthlyRate) + monthlyAmount;
                totalInvested += monthlyAmount;
            }
            // Increment for next year
            monthlyAmount = monthlyAmount * (1 + annualIncrement / 100);
        }
        const returns = futureValue - totalInvested;
        return {
            futureValue: Math.round(futureValue),
            totalInvested: Math.round(totalInvested),
            returns: Math.round(returns),
            percentageGain: ((returns / totalInvested) * 100).toFixed(2),
            finalMonthlyAmount: Math.round(monthlyAmount / (1 + annualIncrement / 100)),
        };
    }
    /**
     * Calculate Debt Fund Post-Tax Returns
     */
    calculateDebtFundReturns(investment, returns, holdingPeriod, taxSlab) {
        const totalReturns = investment * (returns / 100) * holdingPeriod;
        let tax = 0;
        let category = '';
        if (holdingPeriod >= 3) {
            // LTCG with indexation
            category = 'LTCG';
            tax = totalReturns * 0.2; // 20% with indexation benefit
        }
        else {
            // STCG - taxed as per slab
            category = 'STCG';
            tax = totalReturns * (taxSlab / 100);
        }
        const postTaxReturns = totalReturns - tax;
        return {
            totalReturns: Math.round(totalReturns),
            tax: Math.round(tax),
            postTaxReturns: Math.round(postTaxReturns),
            category,
            effectiveTaxRate: ((tax / totalReturns) * 100).toFixed(2),
        };
    }
    /**
     * Parse calculation query and extract parameters
     */
    parseCalculationQuery(query) {
        const queryLower = query.toLowerCase();
        // SIP calculation
        if (queryLower.includes('sip') ||
            queryLower.includes('systematic investment')) {
            const monthlyMatch = query.match(/(\d+)\s*(?:rs|rupees|inr)?/i);
            const yearMatch = query.match(/(\d+)\s*years?/i);
            const returnMatch = query.match(/(\d+(?:\.\d+)?)\s*%/i);
            if (monthlyMatch || yearMatch || returnMatch) {
                return {
                    type: 'sip',
                    params: {
                        monthly: monthlyMatch ? parseFloat(monthlyMatch[1]) : 5000,
                        years: yearMatch ? parseFloat(yearMatch[1]) : 10,
                        returns: returnMatch ? parseFloat(returnMatch[1]) : 12,
                    },
                };
            }
        }
        // Lumpsum calculation
        if (queryLower.includes('lumpsum') || queryLower.includes('one time')) {
            const amountMatch = query.match(/(\d+)\s*(?:rs|rupees|inr)?/i);
            const yearMatch = query.match(/(\d+)\s*years?/i);
            const returnMatch = query.match(/(\d+(?:\.\d+)?)\s*%/i);
            if (amountMatch) {
                return {
                    type: 'lumpsum',
                    params: {
                        amount: parseFloat(amountMatch[1]),
                        years: yearMatch ? parseFloat(yearMatch[1]) : 10,
                        returns: returnMatch ? parseFloat(returnMatch[1]) : 12,
                    },
                };
            }
        }
        // CAGR calculation
        if (queryLower.includes('cagr') || queryLower.includes('growth rate')) {
            const matches = query.match(/(\d+)/g);
            if (matches && matches.length >= 2) {
                return {
                    type: 'cagr',
                    params: {
                        start: parseFloat(matches[0]),
                        end: parseFloat(matches[1]),
                        years: matches[2] ? parseFloat(matches[2]) : 5,
                    },
                };
            }
        }
        return null;
    }
}
exports.CalculationService = CalculationService;
exports.calculationService = new CalculationService();
