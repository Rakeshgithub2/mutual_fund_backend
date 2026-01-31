/**
 * Authentication Middleware
 * JWT token verification and user authentication
 */

const { authConfig } = require('../config/auth.config');

class AuthMiddleware {
  /**
   * Verify JWT access token
   */
  static async verifyToken(req, res, next) {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'No token provided',
          message: 'Authentication required',
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        // Verify token
        const decoded = authConfig.verifyToken(token, false);

        // Attach user info to request
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        };

        next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          message: error.message,
        });
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed',
        message: 'Internal server error',
      });
    }
  }

  /**
   * Optional authentication (doesn't fail if no token)
   */
  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        try {
          const decoded = authConfig.verifyToken(token, false);
          req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
          };
        } catch (error) {
          // Token invalid, but continue without user
          req.user = null;
        }
      } else {
        req.user = null;
      }

      next();
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      req.user = null;
      next();
    }
  }

  /**
   * Require specific role
   */
  static requireRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      if (!authConfig.hasRole(req.user.role, requiredRole)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `${requiredRole} role required`,
        });
      }

      next();
    };
  }

  /**
   * Require admin role
   */
  static requireAdmin(req, res, next) {
    return AuthMiddleware.requireRole('admin')(req, res, next);
  }

  /**
   * Require premium role or higher
   */
  static requirePremium(req, res, next) {
    return AuthMiddleware.requireRole('premium')(req, res, next);
  }

  /**
   * Check if user is accessing their own resource
   */
  static checkOwnership(userIdParam = 'userId') {
    return (req, res, next) => {
      const resourceUserId = req.params[userIdParam] || req.body[userIdParam];

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      // Admins can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user owns the resource
      if (req.user.userId.toString() !== resourceUserId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only access your own resources',
        });
      }

      next();
    };
  }

  /**
   * Verify refresh token
   */
  static async verifyRefreshToken(req, res, next) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'No refresh token provided',
        });
      }

      try {
        const decoded = authConfig.verifyToken(refreshToken, true);

        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        };

        next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
          message: error.message,
        });
      }
    } catch (error) {
      console.error('Refresh token verification error:', error);
      return res.status(500).json({
        success: false,
        error: 'Token verification failed',
      });
    }
  }

  /**
   * Rate limit based on user role
   */
  static roleBasedLimit(req, res, next) {
    if (req.user) {
      req.rateLimit = {
        max: authConfig.getRateLimit(req.user.role),
        role: req.user.role,
      };
    } else {
      req.rateLimit = {
        max: authConfig.getRateLimit('user'),
        role: 'guest',
      };
    }
    next();
  }
}

module.exports = AuthMiddleware;
