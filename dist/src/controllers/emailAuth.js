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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailLogin = exports.emailRegister = void 0;
const bcrypt = __importStar(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongodb_1 = require("../db/mongodb");
const crypto_1 = require("crypto");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;
/**
 * Production-ready Email/Password Registration
 * POST /api/auth/register
 */
const emailRegister = async (req, res) => {
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
        // Validate password length
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters',
            });
        }
        // Get users collection - same pattern as googleAuth
        const db = mongodb_1.mongodb.getDb();
        const usersCollection = db.collection('users');
        // Check if user already exists
        const existingUser = await usersCollection.findOne({
            email: email.toLowerCase().trim(),
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists',
            });
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        // Prepare user data
        const userData = {
            userId: (0, crypto_1.randomUUID)(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            emailVerified: false,
            authMethod: 'email',
            name: name ? name.trim() : `${firstName} ${lastName}`,
            firstName: firstName ? firstName.trim() : name?.split(' ')[0] || '',
            lastName: lastName
                ? lastName.trim()
                : name?.split(' ').slice(1).join(' ') || '',
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
        // Insert user
        await usersCollection.insertOne(userData);
        // Generate JWT token
        const jwtToken = jsonwebtoken_1.default.sign({ userId: userData.userId, email: userData.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        // Return success response
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                accessToken: jwtToken,
                user: {
                    userId: userData.userId,
                    email: userData.email,
                    name: userData.name,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    emailVerified: userData.emailVerified,
                    authMethod: userData.authMethod,
                    preferences: userData.preferences,
                    subscription: userData.subscription,
                    kyc: userData.kyc,
                },
            },
        });
    }
    catch (error) {
        console.error('Email registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed',
            message: error.message,
        });
    }
};
exports.emailRegister = emailRegister;
/**
 * Production-ready Email/Password Login
 * POST /api/auth/login
 */
const emailLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }
        // Get users collection - same pattern as googleAuth
        const db = mongodb_1.mongodb.getDb();
        const usersCollection = db.collection('users');
        // Find user
        const user = await usersCollection.findOne({
            email: email.toLowerCase().trim(),
        });
        if (!user || !user.password) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
            });
        }
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
            });
        }
        // Update last login
        await usersCollection.updateOne({ userId: user.userId }, {
            $set: {
                lastLogin: new Date(),
                updatedAt: new Date(),
            },
        });
        // Generate JWT token
        const jwtToken = jsonwebtoken_1.default.sign({ userId: user.userId, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        // Return success response
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken: jwtToken,
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
    }
    catch (error) {
        console.error('Email login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed',
            message: error.message,
        });
    }
};
exports.emailLogin = emailLogin;
