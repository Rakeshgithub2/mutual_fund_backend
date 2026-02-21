"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.optionalAuth = optionalAuth;
exports.requireSubscription = requireSubscription;
exports.requireKYC = requireKYC;
const auth_service_1 = require("../services/auth.service");
const mongodb_1 = require("../db/mongodb");
// Lazy initialization to avoid calling getDb() before connection
let authService;
function getAuthService() {
    if (!authService) {
        authService = new auth_service_1.AuthService(mongodb_1.mongodb.getDb());
    }
    return authService;
}
/**
 * Middleware to verify JWT access token
 */
async function authenticateToken(req, res, next) {
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
        req.user = {
            userId: user.userId,
            email: user.email,
            name: user.name,
            subscription: user.subscription,
        };
        next();
    }
    catch (error) {
        return res.status(403).json({
            success: false,
            error: error.message || 'Invalid or expired token',
        });
    }
}
/**
 * Optional authentication - proceeds even if no token provided
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            const decoded = getAuthService().verifyAccessToken(token);
            const user = await getAuthService().getUserById(decoded.userId);
            if (user) {
                req.user = {
                    userId: user.userId,
                    email: user.email,
                    name: user.name,
                    subscription: user.subscription,
                };
            }
        }
        next();
    }
    catch (error) {
        // Proceed without authentication
        next();
    }
}
/**
 * Middleware to check subscription plan
 */
function requireSubscription(...allowedPlans) {
    return (req, res, next) => {
        const user = req.user;
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
async function requireKYC(req, res, next) {
    try {
        const userId = req.user?.userId;
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
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message || 'KYC check failed',
        });
    }
}
