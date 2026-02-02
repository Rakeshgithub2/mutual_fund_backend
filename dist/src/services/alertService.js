"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertService = exports.AlertService = void 0;
const db_1 = require("../db");
const queues_1 = require("../queues");
class AlertService {
    async checkAlerts(userId, fundId) {
        const errors = [];
        let checked = 0;
        let triggered = 0;
        try {
            console.log('Starting alert check process...');
            // Build where clause
            const where = {
                isActive: true,
            };
            if (userId) {
                where.userId = userId;
            }
            if (fundId) {
                where.fundId = fundId;
            }
            // Get active alerts
            const alerts = await db_1.prisma.alert.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                        },
                    },
                    fund: {
                        select: {
                            id: true,
                            name: true,
                            amfiCode: true,
                            performances: {
                                orderBy: { date: 'desc' },
                                take: 1,
                            },
                        },
                    },
                },
            });
            console.log(`Found ${alerts.length} active alerts to check`);
            // Check each alert
            for (const alert of alerts) {
                try {
                    checked++;
                    const shouldTrigger = await this.evaluateAlert(alert);
                    if (shouldTrigger) {
                        await this.triggerAlert(alert);
                        triggered++;
                        console.log(`Alert triggered for user ${alert.user.email}, fund ${alert.fund?.name}`);
                    }
                }
                catch (error) {
                    const errorMsg = `Error checking alert ${alert.id}: ${error}`;
                    console.error(errorMsg);
                    errors.push(errorMsg);
                }
            }
            console.log(`Alert check completed. Checked: ${checked}, Triggered: ${triggered}, Errors: ${errors.length}`);
            return { checked, triggered, errors };
        }
        catch (error) {
            console.error('Alert check process failed:', error);
            errors.push(`Alert check failed: ${error}`);
            return { checked, triggered, errors };
        }
    }
    async evaluateAlert(alert) {
        try {
            // Parse alert condition
            const condition = JSON.parse(alert.condition);
            // Get current NAV
            if (!alert.fund || !alert.fund.performances.length) {
                console.warn(`No NAV data available for fund ${alert.fundId}`);
                return false;
            }
            const currentNAV = alert.fund.performances[0].nav;
            const currentDate = alert.fund.performances[0].date;
            // Check if alert was recently triggered (avoid spam)
            if (alert.lastTriggered) {
                const hoursSinceLastTrigger = (Date.now() - new Date(alert.lastTriggered).getTime()) / (1000 * 60 * 60);
                if (hoursSinceLastTrigger < 1) {
                    return false; // Don't trigger again within 1 hour
                }
            }
            switch (alert.type) {
                case 'NAV_THRESHOLD':
                    return this.evaluateNAVThreshold(currentNAV, condition);
                case 'PRICE_CHANGE':
                    return await this.evaluatePriceChange(alert.fund.id, currentNAV, currentDate, condition);
                case 'NEWS':
                    // For news alerts, we would check if there are new relevant news articles
                    // This is a simplified implementation
                    return false;
                default:
                    console.warn(`Unknown alert type: ${alert.type}`);
                    return false;
            }
        }
        catch (error) {
            console.error(`Error evaluating alert ${alert.id}:`, error);
            return false;
        }
    }
    evaluateNAVThreshold(currentNAV, condition) {
        switch (condition.type) {
            case 'above':
                return currentNAV > condition.value;
            case 'below':
                return currentNAV < condition.value;
            default:
                return false;
        }
    }
    async evaluatePriceChange(fundId, currentNAV, currentDate, condition) {
        try {
            if (condition.type !== 'change_percent' || !condition.period) {
                return false;
            }
            // Calculate date range
            const periodDate = new Date(currentDate);
            switch (condition.period) {
                case '1d':
                    periodDate.setDate(periodDate.getDate() - 1);
                    break;
                case '7d':
                    periodDate.setDate(periodDate.getDate() - 7);
                    break;
                case '30d':
                    periodDate.setDate(periodDate.getDate() - 30);
                    break;
            }
            // Get NAV from the period start
            const historicalNAV = await db_1.prisma.fundPerformance.findFirst({
                where: {
                    fundId,
                    date: {
                        lte: periodDate,
                    },
                },
                orderBy: { date: 'desc' },
            });
            if (!historicalNAV) {
                return false;
            }
            // Calculate percentage change
            const changePercent = ((currentNAV - historicalNAV.nav) / historicalNAV.nav) * 100;
            const absChangePercent = Math.abs(changePercent);
            return absChangePercent >= condition.value;
        }
        catch (error) {
            console.error('Error evaluating price change:', error);
            return false;
        }
    }
    async triggerAlert(alert) {
        try {
            // Update lastTriggered timestamp
            await db_1.prisma.alert.update({
                where: { id: alert.id },
                data: { lastTriggered: new Date() },
            });
            // Parse condition for email details
            let conditionText = '';
            let currentValue = '';
            try {
                const condition = JSON.parse(alert.condition);
                const currentNAV = alert.fund?.performances[0]?.nav || 0;
                switch (alert.type) {
                    case 'NAV_THRESHOLD':
                        conditionText = `NAV ${condition.type} ₹${condition.value}`;
                        currentValue = `₹${currentNAV.toFixed(2)}`;
                        break;
                    case 'PRICE_CHANGE':
                        conditionText = `${condition.value}% change over ${condition.period}`;
                        currentValue = `₹${currentNAV.toFixed(2)}`;
                        break;
                    default:
                        conditionText = alert.condition;
                        currentValue = `₹${currentNAV.toFixed(2)}`;
                }
            }
            catch (error) {
                conditionText = alert.condition;
                currentValue = 'N/A';
            }
            // Enqueue email notification
            await (0, queues_1.enqueueSendEmail)({
                to: alert.user.email,
                subject: `Investment Alert - ${alert.fund?.name || 'Fund'}`,
                template: 'alert',
                data: {
                    name: alert.user.name,
                    fundName: alert.fund?.name || 'Unknown Fund',
                    alertType: alert.type,
                    condition: conditionText,
                    currentValue,
                },
            });
            console.log(`Alert notification queued for ${alert.user.email}`);
        }
        catch (error) {
            console.error(`Error triggering alert ${alert.id}:`, error);
            throw error;
        }
    }
    async createPriceAlert(userId, fundId, type, value) {
        const condition = {
            type,
            value,
        };
        return db_1.prisma.alert.create({
            data: {
                userId,
                fundId,
                type: 'NAV_THRESHOLD',
                condition: JSON.stringify(condition),
            },
        });
    }
    async createChangeAlert(userId, fundId, changePercent, period = '1d') {
        const condition = {
            type: 'change_percent',
            value: changePercent,
            period,
        };
        return db_1.prisma.alert.create({
            data: {
                userId,
                fundId,
                type: 'PRICE_CHANGE',
                condition: JSON.stringify(condition),
            },
        });
    }
}
exports.AlertService = AlertService;
exports.alertService = new AlertService();
