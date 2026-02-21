"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.googleSignIn = googleSignIn;
exports.refreshToken = refreshToken;
exports.logout = logout;
exports.logoutAll = logoutAll;
exports.getCurrentUser = getCurrentUser;
exports.updateProfile = updateProfile;
exports.deleteAccount = deleteAccount;
exports.forgotPassword = forgotPassword;
exports.verifyOTP = verifyOTP;
exports.resetPassword = resetPassword;
const auth_service_1 = require("../services/auth.service");
const mongodb_1 = require("../db/mongodb");
const emailService_1 = require("../services/emailService");
// Lazy initialization to avoid calling getDb() before connection
let authService;
async function getAuthService() {
    // Ensure MongoDB connection for serverless
    if (!mongodb_1.mongodb.isConnected()) {
        await mongodb_1.mongodb.connect();
    }
    // Create AuthService instance if not exists
    if (!authService) {
        authService = new auth_service_1.AuthService(mongodb_1.mongodb.getDb());
    }
    return authService;
}
/**
 * Register with Email and Password
 * POST /api/auth/register
 */
async function register(req, res, next) {
    try {
        const { email, password, name, firstName, lastName } = req.body;
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }
        // Require either name OR firstName+lastName
        if (!name && (!firstName || !lastName)) {
            return res.status(400).json({
                success: false,
                error: 'Name (or firstName and lastName) are required',
            });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format',
            });
        }
        // Validate password length (min 8 characters)
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters',
            });
        }
        // Get client info
        const ip = req.headers['x-forwarded-for'] ||
            req.socket.remoteAddress ||
            'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        // Prepare user data
        const userData = {
            email: email.toLowerCase().trim(),
            password,
            name: name ? name.trim() : `${firstName} ${lastName}`,
            firstName: firstName ? firstName.trim() : name?.split(' ')[0],
            lastName: lastName
                ? lastName.trim()
                : name?.split(' ').slice(1).join(' '),
        };
        // Register user
        const authSvc = await getAuthService();
        const user = await authSvc.registerWithEmail(userData.email, userData.password, userData.name, ip, userAgent, userData.firstName, userData.lastName);
        // Send welcome email
        await emailService_1.emailService.sendWelcomeEmail(user.email, {
            name: user.firstName || user.name,
            authMethod: 'email',
        });
        // Generate tokens
        const accessToken = authSvc.generateAccessToken(user);
        const refreshToken = authSvc.generateRefreshToken(user);
        // Save refresh token
        await authSvc.saveRefreshToken(user.userId, refreshToken);
        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome email sent.',
            data: {
                user: {
                    userId: user.userId,
                    email: user.email,
                    name: user.name,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    emailVerified: user.emailVerified,
                    authMethod: user.authMethod,
                    preferences: user.preferences,
                    subscription: user.subscription,
                    kyc: user.kyc,
                },
                tokens: {
                    accessToken,
                    expiresIn: 900,
                },
            },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Registration failed',
        });
    }
}
/**
 * Login with Email and Password
 * POST /api/auth/login
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }
        // Get client info
        const ip = req.headers['x-forwarded-for'] ||
            req.socket.remoteAddress ||
            'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        // Login user
        const authSvc = await getAuthService();
        const user = await authSvc.loginWithEmail(email.toLowerCase().trim(), password, ip, userAgent);
        // Generate tokens
        const accessToken = authSvc.generateAccessToken(user);
        const refreshToken = authSvc.generateRefreshToken(user);
        // Save refresh token
        await authSvc.saveRefreshToken(user.userId, refreshToken);
        // Set refresh token in HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        res.json({
            success: true,
            message: 'Login successful',
            data: {
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
                tokens: {
                    accessToken,
                    expiresIn: 900,
                },
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(401).json({
            success: false,
            error: error.message || 'Login failed',
        });
    }
}
/**
 * Google Sign-In
 * POST /api/auth/google
 */
async function googleSignIn(req, res, next) {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({
                success: false,
                error: 'Google ID token is required',
            });
        }
        // Verify Google token
        const authSvc = await getAuthService();
        const googleData = await authSvc.verifyGoogleToken(idToken);
        // Get client info
        const ip = req.headers['x-forwarded-for'] ||
            req.socket.remoteAddress ||
            'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        // Check if this is a new user
        const existingUser = await authSvc.getUserByEmail(googleData.email);
        const isNewUser = !existingUser;
        // Find or create user
        const user = await authSvc.findOrCreateUser(googleData, ip, userAgent);
        // Send welcome email for new users
        if (isNewUser) {
            await emailService_1.emailService.sendWelcomeEmail(user.email, {
                name: user.name,
                authMethod: 'google',
            });
        }
        // Generate tokens
        const accessToken = authSvc.generateAccessToken(user);
        const refreshToken = authSvc.generateRefreshToken(user);
        // Save refresh token
        await authSvc.saveRefreshToken(user.userId, refreshToken);
        // Set refresh token in HTTP-only cookie for security
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        // Return tokens and user info
        res.json({
            success: true,
            message: isNewUser
                ? 'Registration successful! Welcome email sent.'
                : 'Login successful',
            data: {
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
                tokens: {
                    accessToken,
                    expiresIn: 900, // 15 minutes (in seconds)
                },
            },
        });
    }
    catch (error) {
        console.error('Google sign-in error:', error);
        res.status(401).json({
            success: false,
            error: error.message || 'Authentication failed',
        });
    }
}
/**
 * Refresh access token
 * POST /api/auth/refresh
 */
async function refreshToken(req, res, next) {
    try {
        // Get refresh token from cookie or request body
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token is required',
            });
        }
        // Verify refresh token
        const authSvc = await getAuthService();
        const decoded = authSvc.verifyRefreshToken(refreshToken);
        // Validate against database
        const isValid = await authSvc.validateRefreshToken(decoded.userId, refreshToken);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired refresh token',
            });
        }
        // Get user
        const user = await authSvc.getUserById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        // Generate new access token
        const newAccessToken = authSvc.generateAccessToken(user);
        res.json({
            success: true,
            data: {
                accessToken: newAccessToken,
                expiresIn: 900, // 15 minutes
            },
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            error: error.message || 'Token refresh failed',
        });
    }
}
/**
 * Logout
 * POST /api/auth/logout
 */
async function logout(req, res, next) {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
            });
        }
        // Revoke refresh token
        if (refreshToken) {
            const authSvc = await getAuthService();
            await authSvc.revokeRefreshToken(userId, refreshToken);
        }
        // Clear refresh token cookie
        res.clearCookie('refreshToken');
        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Logout failed',
        });
    }
}
/**
 * Logout from all devices
 * POST /api/auth/logout-all
 */
async function logoutAll(req, res, next) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
            });
        }
        // Revoke all refresh tokens
        const authSvc = await getAuthService();
        await authSvc.revokeAllRefreshTokens(userId);
        res.json({
            success: true,
            message: 'Logged out from all devices successfully',
        });
    }
    catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Logout failed',
        });
    }
}
/**
 * Get current user profile
 * GET /api/auth/me
 */
async function getCurrentUser(req, res, next) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
            });
        }
        const authSvc = await getAuthService();
        const user = await authSvc.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        res.json({
            success: true,
            data: {
                userId: user.userId,
                email: user.email,
                name: user.name,
                firstName: user.firstName,
                lastName: user.lastName,
                picture: user.picture,
                phone: user.phone,
                preferences: user.preferences,
                subscription: user.subscription,
                kyc: user.kyc,
                createdAt: user.createdAt,
            },
        });
    }
    catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch user',
        });
    }
}
/**
 * Update user profile
 * PATCH /api/auth/profile
 */
async function updateProfile(req, res, next) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
            });
        }
        const allowedUpdates = ['phone', 'preferences'];
        const updates = {};
        for (const key of allowedUpdates) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }
        const authSvc = await getAuthService();
        const updatedUser = await authSvc.updateUserProfile(userId, updates);
        res.json({
            success: true,
            data: updatedUser,
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update profile',
        });
    }
}
/**
 * Delete user account
 * DELETE /api/auth/account
 */
async function deleteAccount(req, res, next) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
            });
        }
        const authSvc = await getAuthService();
        await authSvc.deleteUser(userId);
        res.json({
            success: true,
            message: 'Account deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete account',
        });
    }
}
/**
 * Request password reset OTP
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required',
            });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format',
            });
        }
        // Generate and send OTP
        const authSvc = await getAuthService();
        const result = await authSvc.requestPasswordReset(email.toLowerCase().trim());
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.message || 'Failed to send OTP',
            });
        }
        res.json({
            success: true,
            message: 'Password reset OTP has been sent to your email',
            data: {
                email: email.toLowerCase().trim(),
                expiresIn: 600, // 10 minutes in seconds
            },
        });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process password reset request',
        });
    }
}
/**
 * Verify OTP code
 * POST /api/auth/verify-otp
 */
async function verifyOTP(req, res, next) {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Email and OTP are required',
            });
        }
        const authSvc = await getAuthService();
        const result = await authSvc.verifyPasswordResetOTP(email.toLowerCase().trim(), otp.trim());
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.message || 'Invalid or expired OTP',
            });
        }
        res.json({
            success: true,
            message: 'OTP verified successfully',
            data: {
                email: email.toLowerCase().trim(),
                verified: true,
            },
        });
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to verify OTP',
        });
    }
}
/**
 * Reset password with verified OTP
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res, next) {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Email, OTP, and new password are required',
            });
        }
        // Validate password length
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters',
            });
        }
        const authSvc = await getAuthService();
        const result = await authSvc.resetPasswordWithOTP(email.toLowerCase().trim(), otp.trim(), newPassword);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.message || 'Failed to reset password',
            });
        }
        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.',
        });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to reset password',
        });
    }
}
/**
 * Helper function to sanitize user data for API responses
 * Removes sensitive fields like passwords and refresh tokens
 */
function sanitizeUserData(user) {
    return {
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
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
    };
}
