"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMe = exports.getMe = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const response_1 = require("../utils/response");
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    age: zod_1.z.number().min(18).max(100).optional(),
    riskLevel: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});
const getMe = async (req, res) => {
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                age: true,
                riskLevel: true,
                role: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json((0, response_1.formatResponse)(user, 'User profile retrieved successfully'));
    }
    catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getMe = getMe;
const updateMe = async (req, res) => {
    try {
        const validatedData = updateUserSchema.parse(req.body);
        const updateData = {};
        if (validatedData.name !== undefined)
            updateData.name = validatedData.name;
        if (validatedData.age !== undefined)
            updateData.age = validatedData.age;
        if (validatedData.riskLevel !== undefined)
            updateData.riskLevel = validatedData.riskLevel;
        const updatedUser = await db_1.prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                age: true,
                riskLevel: true,
                role: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json((0, response_1.formatResponse)(updatedUser, 'User profile updated successfully'));
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Validation error',
                details: error.errors,
            });
            return;
        }
        console.error('Update user profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateMe = updateMe;
