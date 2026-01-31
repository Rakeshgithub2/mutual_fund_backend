import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { formatResponse } from '../utils/response';
import {
  sendKYCSubmission,
  sendKYCApproval,
  sendKYCRejection,
} from '../services/kycEmailService';

const submitKYCSchema = z.object({
  fullName: z.string().min(2).max(100),
  dateOfBirth: z.string(),
  panNumber: z.string().length(10),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  address: z.string().min(10).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().length(6),
  bankName: z.string().min(2).max(100),
  accountNumber: z.string().min(9).max(18),
  ifscCode: z.string().length(11),
  panFileUrl: z.string().url().optional(),
  aadhaarFileUrl: z.string().url().optional(),
  bankProofUrl: z.string().url().optional(),
});

// Get KYC status for logged-in user
export const getKYCStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const kyc = await prisma.kYC.findUnique({
      where: { userId: req.user!.id },
    });

    if (!kyc) {
      res.json(
        formatResponse(
          { status: 'NOT_SUBMITTED', message: 'KYC not submitted yet' },
          'KYC status fetched successfully'
        )
      );
      return;
    }

    res.json(formatResponse(kyc, 'KYC status fetched successfully'));
  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Submit KYC application
export const submitKYC = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const validatedData = submitKYCSchema.parse(req.body);

    // Check if KYC already submitted
    const existingKYC = await prisma.kYC.findUnique({
      where: { userId: req.user!.id },
    });

    if (existingKYC) {
      if (existingKYC.status === 'APPROVED') {
        res.status(400).json({ error: 'KYC already approved' });
        return;
      }
      if (
        existingKYC.status === 'SUBMITTED' ||
        existingKYC.status === 'UNDER_REVIEW'
      ) {
        res
          .status(400)
          .json({ error: 'KYC already submitted and under review' });
        return;
      }
    }

    // Check for duplicate PAN
    const duplicatePAN = await prisma.kYC.findFirst({
      where: {
        panNumber: validatedData.panNumber,
        userId: { not: req.user!.id },
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
      kyc = await prisma.kYC.update({
        where: { userId: req.user!.id },
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
    } else {
      // Create new KYC - map fields explicitly and normalize optional file URLs to null when missing
      kyc = await prisma.kYC.create({
        data: {
          userId: req.user!.id,
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
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { kycStatus: 'SUBMITTED' },
    });

    // Get user details for email
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    // Send submission confirmation email
    try {
      await sendKYCSubmission(user!.email, user!.name);
    } catch (emailError) {
      console.error('Failed to send KYC submission email:', emailError);
      // Don't fail the submission if email fails
    }

    res
      .status(201)
      .json(formatResponse(kyc, 'KYC submitted successfully', 201));
  } catch (error) {
    if (error instanceof z.ZodError) {
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

// Update KYC status (Admin only)
export const updateKYCStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'ADMIN') {
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

    const kyc = await prisma.kYC.findUnique({
      where: { userId },
    });

    if (!kyc) {
      res.status(404).json({ error: 'KYC not found' });
      return;
    }

    const updatedKYC = await prisma.kYC.update({
      where: { userId },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        reviewedAt: new Date(),
      },
    });

    // Update user KYC status
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: status },
    });

    // Get user details for email
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Send appropriate email
    try {
      if (status === 'APPROVED') {
        await sendKYCApproval(user!.email, user!.name);
      } else if (status === 'REJECTED') {
        await sendKYCRejection(user!.email, user!.name, rejectionReason);
      }
    } catch (emailError) {
      console.error('Failed to send KYC status email:', emailError);
      // Don't fail the update if email fails
    }

    res.json(formatResponse(updatedKYC, 'KYC status updated successfully'));
  } catch (error) {
    console.error('Update KYC status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all KYC applications (Admin only)
export const getAllKYC = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    const { status } = req.query;

    const whereClause: any = {};
    if (status) whereClause.status = status;

    const kycApplications = await prisma.kYC.findMany({
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

    res.json(
      formatResponse(kycApplications, 'KYC applications fetched successfully')
    );
  } catch (error) {
    console.error('Get all KYC error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete KYC (Admin only or user's own rejected KYC)
export const deleteKYC = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Check permissions
    if (req.user!.role !== 'ADMIN' && req.user!.id !== userId) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return;
    }

    const kyc = await prisma.kYC.findUnique({
      where: { userId },
    });

    if (!kyc) {
      res.status(404).json({ error: 'KYC not found' });
      return;
    }

    // Only allow deletion of rejected KYC (unless admin)
    if (req.user!.role !== 'ADMIN' && kyc.status !== 'REJECTED') {
      res.status(400).json({
        error: 'Can only delete rejected KYC applications',
      });
      return;
    }

    await prisma.kYC.delete({
      where: { userId },
    });

    // Update user KYC status
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: 'PENDING' },
    });

    res.json(formatResponse(null, 'KYC deleted successfully'));
  } catch (error) {
    console.error('Delete KYC error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
