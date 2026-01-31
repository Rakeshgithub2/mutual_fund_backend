import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { mongodb } from '../db/mongodb';
import { User } from '../db/schemas';
import { randomUUID } from 'crypto';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

/**
 * Production-ready Google OAuth Login Handler
 * POST /api/auth/google
 */
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token missing',
      });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token',
      });
    }

    // Extract user data from Google payload
    const googleId = payload.sub;
    const email = payload.email!;
    const name = payload.name || '';
    const firstName = payload.given_name || '';
    const lastName = payload.family_name || '';
    const picture = payload.picture || '';

    // Get users collection
    const db = mongodb.getDb();
    const usersCollection = db.collection<User>('users');

    // Find or create user
    let user = await usersCollection.findOne({ googleId });

    if (!user) {
      // Check if email already exists with different auth method
      const existingEmailUser = await usersCollection.findOne({ email });

      if (existingEmailUser && existingEmailUser.authMethod === 'email') {
        return res.status(400).json({
          success: false,
          message:
            'This email is already registered with email/password. Please login with your password.',
        });
      }

      // Create new user
      const newUser: User = {
        userId: randomUUID(),
        googleId,
        email,
        emailVerified: true, // Google emails are verified
        authMethod: 'google',
        name,
        firstName,
        lastName,
        picture,
        preferences: {
          theme: 'light',
          language: 'en',
          currency: 'INR',
          riskProfile: 'moderate',
          notifications: {
            email: true,
            push: true,
            priceAlerts: true,
            newsAlerts: true,
          },
        },
        kyc: {
          status: 'pending',
        },
        subscription: {
          plan: 'free',
          autoRenew: false,
        },
        refreshTokens: [],
        lastLogin: new Date(),
        loginHistory: [],
        isActive: true,
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await usersCollection.insertOne(newUser);
      user = newUser as any;
    } else {
      // Update last login
      await usersCollection.updateOne(
        { userId: user.userId },
        {
          $set: {
            lastLogin: new Date(),
            updatedAt: new Date(),
          },
        }
      );
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user.userId, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Return success response
    res.status(200).json({
      success: true,
      message: user.googleId ? 'Login successful' : 'Registration successful',
      data: {
        token: jwtToken,
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          picture: user.picture,
          emailVerified: user.emailVerified,
          authMethod: user.authMethod,
          preferences: user.preferences,
          subscription: user.subscription,
          kyc: user.kyc,
        },
      },
    });
  } catch (error: any) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      message: 'Google login failed',
      error: error.message,
    });
  }
};
