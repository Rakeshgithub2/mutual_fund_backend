/**
 * Authentication Configuration
 * JWT-based authentication with refresh tokens
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET =
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

const AUTH_CONFIG = {
  // JWT configuration
  jwt: {
    secret: JWT_SECRET,
    refreshSecret: JWT_REFRESH_SECRET,
    accessTokenExpiry: '15m', // 15 minutes
    refreshTokenExpiry: '7d', // 7 days
    algorithm: 'HS256',
  },

  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: {
      login: 5, // 5 login attempts per window
      register: 3, // 3 registration attempts per window
      api: 1000, // 1000 API calls per window (free users)
      apiPremium: 5000, // 5000 API calls per window (premium users)
      fundQueries: 5000, // 5000 fund queries per window (read-only DB operations, supports 500+ concurrent users)
    },
  },

  // Session configuration
  session: {
    maxActiveSessions: 3, // Max concurrent sessions per user
    extendOnActivity: true, // Extend session on each request
  },

  // User roles
  roles: {
    USER: 'user',
    ADMIN: 'admin',
    PREMIUM: 'premium',
  },

  // Token types
  tokenTypes: {
    ACCESS: 'access',
    REFRESH: 'refresh',
    EMAIL_VERIFICATION: 'email_verification',
    PASSWORD_RESET: 'password_reset',
  },
};

class AuthConfig {
  /**
   * Generate JWT access token
   */
  generateAccessToken(payload) {
    try {
      return jwt.sign(
        {
          ...payload,
          type: AUTH_CONFIG.tokenTypes.ACCESS,
        },
        AUTH_CONFIG.jwt.secret,
        {
          expiresIn: AUTH_CONFIG.jwt.accessTokenExpiry,
          algorithm: AUTH_CONFIG.jwt.algorithm,
        }
      );
    } catch (error) {
      console.error('❌ Error generating access token:', error.message);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(payload) {
    try {
      return jwt.sign(
        {
          ...payload,
          type: AUTH_CONFIG.tokenTypes.REFRESH,
        },
        AUTH_CONFIG.jwt.refreshSecret,
        {
          expiresIn: AUTH_CONFIG.jwt.refreshTokenExpiry,
          algorithm: AUTH_CONFIG.jwt.algorithm,
        }
      );
    } catch (error) {
      console.error('❌ Error generating refresh token:', error.message);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(userId, email) {
    try {
      return jwt.sign(
        {
          userId,
          email,
          type: AUTH_CONFIG.tokenTypes.EMAIL_VERIFICATION,
        },
        AUTH_CONFIG.jwt.secret,
        {
          expiresIn: '24h',
          algorithm: AUTH_CONFIG.jwt.algorithm,
        }
      );
    } catch (error) {
      console.error(
        '❌ Error generating email verification token:',
        error.message
      );
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(userId, email) {
    try {
      return jwt.sign(
        {
          userId,
          email,
          type: AUTH_CONFIG.tokenTypes.PASSWORD_RESET,
        },
        AUTH_CONFIG.jwt.secret,
        {
          expiresIn: '1h',
          algorithm: AUTH_CONFIG.jwt.algorithm,
        }
      );
    } catch (error) {
      console.error('❌ Error generating password reset token:', error.message);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token, isRefreshToken = false) {
    try {
      const secret = isRefreshToken
        ? AUTH_CONFIG.jwt.refreshSecret
        : AUTH_CONFIG.jwt.secret;

      return jwt.verify(token, secret, {
        algorithms: [AUTH_CONFIG.jwt.algorithm],
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      console.error('❌ Error decoding token:', error.message);
      return null;
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password) {
    const errors = [];
    const config = AUTH_CONFIG.password;

    if (password.length < config.minLength) {
      errors.push(
        `Password must be at least ${config.minLength} characters long`
      );
    }

    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (config.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (
      config.requireSpecialChars &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get authentication configuration
   */
  getConfig() {
    return AUTH_CONFIG;
  }

  /**
   * Check if user has required role
   */
  hasRole(userRole, requiredRole) {
    const roleHierarchy = {
      admin: 3,
      premium: 2,
      user: 1,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Get rate limit for user role
   */
  getRateLimit(role) {
    if (
      role === AUTH_CONFIG.roles.PREMIUM ||
      role === AUTH_CONFIG.roles.ADMIN
    ) {
      return AUTH_CONFIG.rateLimit.maxRequests.apiPremium;
    }
    return AUTH_CONFIG.rateLimit.maxRequests.api;
  }
}

// Singleton instance
const authConfig = new AuthConfig();

module.exports = {
  authConfig,
  AUTH_CONFIG,
};
