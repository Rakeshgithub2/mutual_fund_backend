"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlerts = exports.createAlert = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const response_1 = require("../utils/response");
const createAlertSchema = zod_1.z.object({
    fundId: zod_1.z.string().cuid().optional(),
    type: zod_1.z.enum(['NAV_THRESHOLD', 'PRICE_CHANGE', 'NEWS']),
    condition: zod_1.z.string(), // JSON string with alert conditions
});
const createAlert = async (req, res) => {
    try {
        const validatedData = createAlertSchema.parse(req.body);
        // Validate fundId if provided
        if (validatedData.fundId) {
            const fund = await db_1.prisma.fund.findUnique({
                where: { id: validatedData.fundId },
            });
            if (!fund) {
                res.status(404).json({ error: 'Fund not found' });
                return;
            }
        }
        const alert = await db_1.prisma.alert.create({
            data: {
                fundId: validatedData.fundId || null,
                type: validatedData.type,
                condition: validatedData.condition,
                userId: req.user.id,
            },
            include: {
                fund: {
                    select: {
                        id: true,
                        name: true,
                        amfiCode: true,
                    },
                },
            },
        });
        res
            .status(201)
            .json((0, response_1.formatResponse)(alert, 'Alert created successfully', 201));
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Validation error',
                details: error.errors,
            });
            return;
        }
        console.error('Create alert error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createAlert = createAlert;
const getAlerts = async (req, res) => {
    try {
        const alerts = await db_1.prisma.alert.findMany({
            where: { userId: req.user.id },
            include: {
                fund: {
                    select: {
                        id: true,
                        name: true,
                        amfiCode: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json((0, response_1.formatResponse)(alerts, 'Alerts retrieved successfully'));
    }
    catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAlerts = getAlerts;
