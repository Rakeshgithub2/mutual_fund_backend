"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const google_auth_library_1 = require("google-auth-library");
const jwt = __importStar(require("jsonwebtoken"));
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const client = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = '15m'; // Short-lived access token as per security spec
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12; // Strong password hashing
class AuthService {
    constructor(db) {
        this.db = db;
    }
    /**
     * Verify Google ID token and return user info
     */
    async verifyGoogleToken(idToken) {
        try {
            const ticket = await client.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (!payload) {
                throw new Error('Invalid token payload');
            }
            // Validate email verification as per security spec
            if (!payload.email_verified) {
                throw new Error('Email not verified by Google');
            }
            return {
                sub: payload.sub,
                email: payload.email,
                email_verified: payload.email_verified,
                name: payload.name || '',
                given_name: payload.given_name || '',
                family_name: payload.family_name || '',
                picture: payload.picture,
            };
        }
        catch (error) {
            throw new Error(`Google token verification failed: ${error.message}`);
        }
    }
    /**
     * Register new user with email and password
     */
    async registerWithEmail(email, password, name, ip, userAgent, firstName, lastName) {
        const usersCollection = this.db.collection('users');
        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            // Check if user registered with Google
            if (existingUser.authMethod === 'google') {
                throw new Error('This email is registered using Google. Please login with Google.');
            }
            throw new Error('User with this email already exists');
        }
        // Validate password length only
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        // Use provided firstName/lastName or split name
        let userFirstName = firstName;
        let userLastName = lastName;
        if (!firstName || !lastName) {
            const nameParts = name.trim().split(' ');
            userFirstName = nameParts[0] || name;
            userLastName = nameParts.slice(1).join(' ') || '';
        }
        // Create new user
        const newUser = {
            userId: (0, crypto_1.randomUUID)(),
            email,
            password: hashedPassword,
            emailVerified: false, // Email verification required
            authMethod: 'email',
            name,
            firstName: userFirstName,
            lastName: userLastName,
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
            loginHistory: [
                {
                    timestamp: new Date(),
                    ip,
                    userAgent,
                },
            ],
            isActive: true,
            isBlocked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await usersCollection.insertOne(newUser);
        return newUser;
    }
    /**
     * Login user with email and password
     */
    async loginWithEmail(email, password, ip, userAgent) {
        const usersCollection = this.db.collection('users');
        // Find user by email
        const user = await usersCollection.findOne({
            email,
            isActive: true,
            isBlocked: false,
        });
        if (!user) {
            throw new Error('Invalid email or password');
        }
        // Check if user is Google-only (never set a password)
        if (user.authMethod === 'google') {
            throw new Error('This account uses Google Sign-In. Please login with Google.');
        }
        // Check if user has password (safety check)
        if (!user.password) {
            throw new Error('Password not set for this account. Please use Google Sign-In or reset your password.');
        }
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }
        // Update last login
        await usersCollection.updateOne({ userId: user.userId }, {
            $set: {
                lastLogin: new Date(),
                updatedAt: new Date(),
            },
            $push: {
                loginHistory: {
                    $each: [
                        {
                            timestamp: new Date(),
                            ip,
                            userAgent,
                        },
                    ],
                    $slice: -50,
                },
            },
        });
        return user;
    }
    /**
     * Create or update user from Google profile
     */
    async findOrCreateUser(googleData, ip, userAgent) {
        const usersCollection = this.db.collection('users');
        // Check if user exists by Google ID
        let user = await usersCollection.findOne({ googleId: googleData.sub });
        if (user) {
            // Update existing user
            const updateData = {
                name: googleData.name,
                firstName: googleData.given_name,
                lastName: googleData.family_name,
                picture: googleData.picture,
                emailVerified: googleData.email_verified,
                lastLogin: new Date(),
                updatedAt: new Date(),
            };
            await usersCollection.updateOne({ googleId: googleData.sub }, {
                $set: updateData,
                $push: {
                    loginHistory: {
                        $each: [
                            {
                                timestamp: new Date(),
                                ip,
                                userAgent,
                            },
                        ],
                        $slice: -50,
                    },
                },
            });
            user = await usersCollection.findOne({ googleId: googleData.sub });
            return user;
        }
        // Check if user exists by email (may have registered with email/password)
        user = await usersCollection.findOne({ email: googleData.email });
        if (user) {
            // Link Google account to existing email/password account
            await usersCollection.updateOne({ userId: user.userId }, {
                $set: {
                    googleId: googleData.sub,
                    authMethod: 'both',
                    emailVerified: true, // Google verifies email
                    picture: googleData.picture,
                    lastLogin: new Date(),
                    updatedAt: new Date(),
                },
                $push: {
                    loginHistory: {
                        $each: [
                            {
                                timestamp: new Date(),
                                ip,
                                userAgent,
                            },
                        ],
                        $slice: -50,
                    },
                },
            });
            user = await usersCollection.findOne({ userId: user.userId });
            return user;
        }
        // Create new user with Google
        const newUser = {
            userId: (0, crypto_1.randomUUID)(),
            googleId: googleData.sub,
            email: googleData.email,
            password: undefined, // No password for Google users
            emailVerified: googleData.email_verified,
            authMethod: 'google',
            name: googleData.name,
            firstName: googleData.given_name,
            lastName: googleData.family_name,
            picture: googleData.picture,
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
            loginHistory: [
                {
                    timestamp: new Date(),
                    ip,
                    userAgent,
                },
            ],
            isActive: true,
            isBlocked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await usersCollection.insertOne(newUser);
        return newUser;
    }
    /**
     * Generate JWT access token
     */
    generateAccessToken(user) {
        const payload = {
            userId: user.userId,
            email: user.email,
            name: user.name,
            type: 'access',
        };
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });
    }
    /**
     * Generate JWT refresh token
     */
    generateRefreshToken(user) {
        const payload = {
            userId: user.userId,
            email: user.email,
            name: user.name,
            type: 'refresh',
        };
        return jwt.sign(payload, JWT_REFRESH_SECRET, {
            expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        });
    }
    /**
     * Save refresh token to database
     */
    async saveRefreshToken(userId, refreshToken) {
        const usersCollection = this.db.collection('users');
        await usersCollection.updateOne({ userId }, {
            $push: { refreshTokens: refreshToken },
            $slice: { refreshTokens: -5 }, // Keep only last 5 refresh tokens
        });
    }
    /**
     * Verify JWT access token
     */
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }
            return decoded;
        }
        catch (error) {
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }
    /**
     * Verify JWT refresh token
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            return decoded;
        }
        catch (error) {
            throw new Error(`Refresh token verification failed: ${error.message}`);
        }
    }
    /**
     * Validate refresh token against database
     */
    async validateRefreshToken(userId, refreshToken) {
        const usersCollection = this.db.collection('users');
        const user = await usersCollection.findOne({
            userId,
            refreshTokens: refreshToken,
            isActive: true,
            isBlocked: false,
        });
        return !!user;
    }
    /**
     * Revoke refresh token
     */
    async revokeRefreshToken(userId, refreshToken) {
        const usersCollection = this.db.collection('users');
        await usersCollection.updateOne({ userId }, { $pull: { refreshTokens: refreshToken } });
    }
    /**
     * Revoke all refresh tokens for a user
     */
    async revokeAllRefreshTokens(userId) {
        const usersCollection = this.db.collection('users');
        await usersCollection.updateOne({ userId }, { $set: { refreshTokens: [] } });
    }
    /**
     * Get user by userId
     */
    async getUserById(userId) {
        const usersCollection = this.db.collection('users');
        return await usersCollection.findOne({
            userId,
            isActive: true,
            isBlocked: false,
        });
    }
    /**
     * Get user by email
     */
    async getUserByEmail(email) {
        const usersCollection = this.db.collection('users');
        return await usersCollection.findOne({
            email,
            isActive: true,
            isBlocked: false,
        });
    }
    /**
     * Update user profile
     */
    async updateUserProfile(userId, updates) {
        const usersCollection = this.db.collection('users');
        await usersCollection.updateOne({ userId }, {
            $set: {
                ...updates,
                updatedAt: new Date(),
            },
        });
        return await this.getUserById(userId);
    }
    /**
     * Delete user account (soft delete)
     */
    async deleteUser(userId) {
        const usersCollection = this.db.collection('users');
        await usersCollection.updateOne({ userId }, {
            $set: {
                isActive: false,
                refreshTokens: [],
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Generate 6-digit OTP
     */
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    /**
     * Request password reset - Generate and send OTP
     */
    async requestPasswordReset(email) {
        const usersCollection = this.db.collection('users');
        const otpCollection = this.db.collection('password_reset_otps');
        // Check if user exists
        const user = await usersCollection.findOne({ email });
        if (!user) {
            // Don't reveal if user exists or not for security
            return {
                success: true,
                message: 'If your email is registered, you will receive an OTP',
            };
        }
        // Generate OTP
        const otp = this.generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        // Delete any existing OTPs for this email
        await otpCollection.deleteMany({ email });
        // Store OTP
        await otpCollection.insertOne({
            email,
            otp,
            expiresAt,
            verified: false,
            attempts: 0,
            createdAt: new Date(),
        });
        // Send OTP email
        const emailService = require('./emailService').emailService;
        try {
            await emailService.sendPasswordResetOTP(email, {
                name: user.firstName || user.name,
                otp,
            });
        }
        catch (error) {
            console.error('Failed to send OTP email:', error);
            return { success: false, message: 'Failed to send OTP email' };
        }
        return { success: true };
    }
    /**
     * Verify password reset OTP
     */
    async verifyPasswordResetOTP(email, otp) {
        const otpCollection = this.db.collection('password_reset_otps');
        const otpRecord = await otpCollection.findOne({ email, otp });
        if (!otpRecord) {
            // Increment attempt counter if OTP exists for this email
            await otpCollection.updateOne({ email }, { $inc: { attempts: 1 } });
            return { success: false, message: 'Invalid OTP' };
        }
        // Check if expired
        if (new Date() > otpRecord.expiresAt) {
            return {
                success: false,
                message: 'OTP has expired. Please request a new one',
            };
        }
        // Check if already verified
        if (otpRecord.verified) {
            return { success: false, message: 'OTP has already been used' };
        }
        // Check attempts
        if (otpRecord.attempts >= 5) {
            return {
                success: false,
                message: 'Too many failed attempts. Please request a new OTP',
            };
        }
        // Mark as verified
        await otpCollection.updateOne({ email, otp }, { $set: { verified: true } });
        return { success: true };
    }
    /**
     * Reset password with verified OTP
     */
    async resetPasswordWithOTP(email, otp, newPassword) {
        const usersCollection = this.db.collection('users');
        const otpCollection = this.db.collection('password_reset_otps');
        // Find OTP record
        const otpRecord = await otpCollection.findOne({ email, otp });
        if (!otpRecord) {
            return { success: false, message: 'Invalid OTP' };
        }
        // Check if verified
        if (!otpRecord.verified) {
            return {
                success: false,
                message: 'OTP not verified. Please verify OTP first',
            };
        }
        // Check if expired
        if (new Date() > otpRecord.expiresAt) {
            return {
                success: false,
                message: 'OTP has expired. Please request a new one',
            };
        }
        // Validate new password
        if (newPassword.length < 6) {
            return {
                success: false,
                message: 'Password must be at least 6 characters long',
            };
        }
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        // Update user password
        const result = await usersCollection.updateOne({ email }, {
            $set: {
                password: hashedPassword,
                updatedAt: new Date(),
            },
            $unset: {
                refreshTokens: '', // Invalidate all refresh tokens
            },
        });
        if (result.matchedCount === 0) {
            return { success: false, message: 'User not found' };
        }
        // Delete used OTP
        await otpCollection.deleteOne({ email, otp });
        // Send confirmation email
        const user = await usersCollection.findOne({ email });
        if (user) {
            const emailService = require('./emailService').emailService;
            try {
                await emailService.sendPasswordChangedEmail(email, {
                    name: user.firstName || user.name,
                });
            }
            catch (error) {
                console.error('Failed to send password changed email:', error);
            }
        }
        return { success: true };
    }
}
exports.AuthService = AuthService;
