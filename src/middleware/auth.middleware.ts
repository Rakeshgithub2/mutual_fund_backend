import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { mongodb } from '../db/mongodb';

// Lazy initialization to avoid calling getDb() before connection
let authService: AuthService;
function getAuthService() {
  if (!authService) {
    authService = new AuthService(mongodb.getDb());
  }
  return authService;
}

/**
 * Middleware to verify JWT access token
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
      });
    }

    // Verify token
    const decoded = getAuthService().verifyAccessToken(token);

    // Get user from database
    const user = await getAuthService().getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Attach user to request
    (req as any).user = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      subscription: user.subscription,
    };

    next();
  } catch (error: any) {
    return res.status(403).json({
      success: false,
      error: error.message || 'Invalid or expired token',
    });
  }
}

/**
 * Optional authentication - proceeds even if no token provided
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = getAuthService().verifyAccessToken(token);
      const user = await getAuthService().getUserById(decoded.userId);

      if (user) {
        (req as any).user = {
          userId: user.userId,
          email: user.email,
          name: user.name,
          subscription: user.subscription,
        };
      }
    }

    next();
  } catch (error) {
    // Proceed without authentication
    next();
  }
}

/**
 * Middleware to check subscription plan
 */
export function requireSubscription(...allowedPlans: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const userPlan = user.subscription?.plan || 'free';

    if (!allowedPlans.includes(userPlan)) {
      return res.status(403).json({
        success: false,
        error: 'This feature requires a premium subscription',
        requiredPlans: allowedPlans,
      });
    }

    next();
  };
}

/**
 * Middleware to check KYC verification
 */
export async function requireKYC(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const user = await getAuthService().getUserById(userId);
    if (!user || user.kyc.status !== 'verified') {
      return res.status(403).json({
        success: false,
        error: 'KYC verification required',
        kycStatus: user?.kyc.status || 'pending',
      });
    }

    next();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'KYC check failed',
    });
  }
}
