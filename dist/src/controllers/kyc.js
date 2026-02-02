"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteKYC = exports.getAllKYC = exports.updateKYCStatus = exports.submitKYC = exports.getKYCStatus = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const response_1 = require("../utils/response");
const kycEmailService_1 = require("../services/kycEmailService");
const submitKYCSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2).max(100),
    dateOfBirth: zod_1.z.string(),
    panNumber: zod_1.z.string().length(10),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(10).max(15),
    address: zod_1.z.string().min(10).max(500),
    city: zod_1.z.string().min(2).max(100),
    state: zod_1.z.string().min(2).max(100),
    pincode: zod_1.z.string().length(6),
    bankName: zod_1.z.string().min(2).max(100),
    accountNumber: zod_1.z.string().min(9).max(18),
    ifscCode: zod_1.z.string().length(11),
    panFileUrl: zod_1.z.string().url().optional(),
    aadhaarFileUrl: zod_1.z.string().url().optional(),
    bankProofUrl: zod_1.z.string().url().optional(),
});
// Get KYC status for logged-in user
const getKYCStatus = async (req, res) => {
    try {
        const kyc = await db_1.prisma.kYC.findUnique({
            where: { userId: req.user.id },
        });
        if (!kyc) {
            res.json((0, response_1.formatResponse)({ status: 'NOT_SUBMITTED', message: 'KYC not submitted yet' }, 'KYC status fetched successfully'));
            return;
        }
        res.json((0, response_1.formatResponse)(kyc, 'KYC status fetched successfully'));
    }
    catch (error) {
        console.error('Get KYC status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getKYCStatus = getKYCStatus;
// Submit KYC application
const submitKYC = async (req, res) => {
    try {
        const validatedData = submitKYCSchema.parse(req.body);
        // Check if KYC already submitted
        const existingKYC = await db_1.prisma.kYC.findUnique({
            where: { userId: req.user.id },
        });
        if (existingKYC) {
            if (existingKYC.status === 'APPROVED') {
                res.status(400).json({ error: 'KYC already approved' });
                return;
            }
            if (existingKYC.status === 'SUBMITTED' ||
                existingKYC.status === 'UNDER_REVIEW') {
                res
                    .status(400)
                    .json({ error: 'KYC already submitted and under review' });
                return;
            }
        }
        // Check for duplicate PAN
        const duplicatePAN = await db_1.prisma.kYC.findFirst({
            where: {
                panNumber: validatedData.panNumber,
                userId: { not: req.user.id },
            },
        });
        if (duplicatePAN) {
            res.status(400).json({
                error: 'PAN number already registered with another account',
            });
            return;
        }
        let kyc;
        if (existingKYC) {
            // Update existing rejected KYC - map fields explicitly so Prisma doesn't receive undefined for nullable fields
            kyc = await db_1.prisma.kYC.update({
                where: { userId: req.user.id },
                data: {
                    status: 'SUBMITTED',
                    rejectionReason: null,
                    submittedAt: new Date(),
                    email: validatedData.email,
                    fullName: validatedData.fullName,
                    dateOfBirth: validatedData.dateOfBirth,
                    panNumber: validatedData.panNumber,
                    phone: validatedData.phone,
                    address: validatedData.address,
                    city: validatedData.city,
                    state: validatedData.state,
                    pincode: validatedData.pincode,
                    bankName: validatedData.bankName,
                    accountNumber: validatedData.accountNumber,
                    ifscCode: validatedData.ifscCode,
                    panFileUrl: validatedData.panFileUrl ?? null,
                    aadhaarFileUrl: validatedData.aadhaarFileUrl ?? null,
                    bankProofUrl: validatedData.bankProofUrl ?? null,
                },
            });
        }
        else {
            // Create new KYC - map fields explicitly and normalize optional file URLs to null when missing
            kyc = await db_1.prisma.kYC.create({
                data: {
                    userId: req.user.id,
                    email: validatedData.email,
                    fullName: validatedData.fullName,
                    dateOfBirth: validatedData.dateOfBirth,
                    panNumber: validatedData.panNumber,
                    phone: validatedData.phone,
                    address: validatedData.address,
                    city: validatedData.city,
                    state: validatedData.state,
                    pincode: validatedData.pincode,
                    bankName: validatedData.bankName,
                    accountNumber: validatedData.accountNumber,
                    ifscCode: validatedData.ifscCode,
                    panFileUrl: validatedData.panFileUrl ?? null,
                    aadhaarFileUrl: validatedData.aadhaarFileUrl ?? null,
                    bankProofUrl: validatedData.bankProofUrl ?? null,
                    status: 'SUBMITTED',
                },
            });
        }
        // Update user KYC status
        await db_1.prisma.user.update({
            where: { id: req.user.id },
            data: { kycStatus: 'SUBMITTED' },
        });
        // Get user details for email
        const user = await db_1.prisma.user.findUnique({
            where: { id: req.user.id },
        });
        // Send submission confirmation email
        try {
            await (0, kycEmailService_1.sendKYCSubmission)(user.email, user.name);
        }
        catch (emailError) {
            console.error('Failed to send KYC submission email:', emailError);
            // Don't fail the submission if email fails
        }
        res
            .status(201)
            .json((0, response_1.formatResponse)(kyc, 'KYC submitted successfully', 201));
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Validation error',
                details: error.errors,
            });
            return;
        }
        console.error('Submit KYC error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.submitKYC = submitKYC;
// Update KYC status (Admin only)
const updateKYCStatus = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'ADMIN') {
            res.status(403).json({ error: 'Forbidden: Admin access required' });
            return;
        }
        const { userId } = req.params;
        const { status, rejectionReason } = req.body;
        if (!['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(status)) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }
        if (status === 'REJECTED' && !rejectionReason) {
            res.status(400).json({
                error: 'Rejection reason is required when rejecting KYC',
            });
            return;
        }
        const kyc = await db_1.prisma.kYC.findUnique({
            where: { userId },
        });
        if (!kyc) {
            res.status(404).json({ error: 'KYC not found' });
            return;
        }
        const updatedKYC = await db_1.prisma.kYC.update({
            where: { userId },
            data: {
                status,
                rejectionReason: status === 'REJECTED' ? rejectionReason : null,
                reviewedAt: new Date(),
            },
        });
        // Update user KYC status
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { kycStatus: status },
        });
        // Get user details for email
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
        });
        // Send appropriate email
        try {
            if (status === 'APPROVED') {
                await (0, kycEmailService_1.sendKYCApproval)(user.email, user.name);
            }
            else if (status === 'REJECTED') {
                await (0, kycEmailService_1.sendKYCRejection)(user.email, user.name, rejectionReason);
            }
        }
        catch (emailError) {
            console.error('Failed to send KYC status email:', emailError);
            // Don't fail the update if email fails
        }
        res.json((0, response_1.formatResponse)(updatedKYC, 'KYC status updated successfully'));
    }
    catch (error) {
        console.error('Update KYC status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateKYCStatus = updateKYCStatus;
// Get all KYC applications (Admin only)
const getAllKYC = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'ADMIN') {
            res.status(403).json({ error: 'Forbidden: Admin access required' });
            return;
        }
        const { status } = req.query;
        const whereClause = {};
        if (status)
            whereClause.status = status;
        const kycApplications = await db_1.prisma.kYC.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
        res.json((0, response_1.formatResponse)(kycApplications, 'KYC applications fetched successfully'));
    }
    catch (error) {
        console.error('Get all KYC error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAllKYC = getAllKYC;
// Delete KYC (Admin only or user's own rejected KYC)
const deleteKYC = async (req, res) => {
    try {
        const { userId } = req.params;
        // Check permissions
        if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
            res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            return;
        }
        const kyc = await db_1.prisma.kYC.findUnique({
            where: { userId },
        });
        if (!kyc) {
            res.status(404).json({ error: 'KYC not found' });
            return;
        }
        // Only allow deletion of rejected KYC (unless admin)
        if (req.user.role !== 'ADMIN' && kyc.status !== 'REJECTED') {
            res.status(400).json({
                error: 'Can only delete rejected KYC applications',
            });
            return;
        }
        await db_1.prisma.kYC.delete({
            where: { userId },
        });
        // Update user KYC status
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { kycStatus: 'PENDING' },
        });
        res.json((0, response_1.formatResponse)(null, 'KYC deleted successfully'));
    }
    catch (error) {
        console.error('Delete KYC error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteKYC = deleteKYC;
