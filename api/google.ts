import { Request, Response } from 'express';
import { mongodb } from '../src/db/mongodb';
import { googleLogin } from '../src/controllers/googleAuth';

const AuthController = require('../src/controllers/auth.controller');

export default async function handler(req: Request, res: Response) {
  try {
    // Set CORS headers
    const allowedOrigins = [
      'https://mf-frontend-coral.vercel.app',
      'https://mutual-fun-frontend-osed.vercel.app',
      'http://localhost:3000',
      'http://localhost:5001',
      'http://localhost:5173',
    ];

    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Connect to MongoDB
    await mongodb.connect();

    // Handle GET request - initiate OAuth flow
    if (req.method === 'GET') {
      // Check if AuthController has the method
      if (typeof AuthController.googleAuth !== 'function') {
        return res.status(500).json({
          success: false,
          error: 'Server configuration error',
          message: 'Google Auth not properly configured',
          debug: {
            hasAuthController: !!AuthController,
            authControllerType: typeof AuthController,
            hasGoogleAuth: 'googleAuth' in AuthController,
            googleAuthType: typeof AuthController.googleAuth,
          },
        });
      }
      return await AuthController.googleAuth(req, res);
    }

    // Handle POST request - exchange token
    if (req.method === 'POST') {
      return await googleLogin(req, res);
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: `Method ${req.method} not allowed`,
    });
  } catch (error: any) {
    console.error('Google auth route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}
