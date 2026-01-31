import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AuthRequest } from '../middlewares/auth';
import { formatResponse } from '../utils/response';
import { hashPassword } from '../utils/auth';

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  age: z.number().min(18).max(100).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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

    res.json(formatResponse(user, 'User profile retrieved successfully'));
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const validatedData = updateUserSchema.parse(req.body);

    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.age !== undefined) updateData.age = validatedData.age;
    if (validatedData.riskLevel !== undefined)
      updateData.riskLevel = validatedData.riskLevel;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
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

    res.json(formatResponse(updatedUser, 'User profile updated successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
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
