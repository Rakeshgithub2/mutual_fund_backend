"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthController = exports.OAuthController = void 0;
const google_auth_library_1 = require("google-auth-library");
const db_1 = require("../db");
const response_1 = require("../utils/response");
const auth_1 = require("../utils/auth");
class OAuthController {
    constructor() {
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
            throw new Error('GOOGLE_CLIENT_ID is not configured');
        }
        this.googleClient = new google_auth_library_1.OAuth2Client(googleClientId);
    }
    async googleAuth(req, res) {
        try {
            const { token } = req.body;
            if (!token) {
                res.status(400).json({ error: 'Google token is required' });
                return;
            }
            const googleClientId = process.env.GOOGLE_CLIENT_ID;
            if (!googleClientId) {
                res.status(500).json({ error: 'Google authentication not configured' });
                return;
            }
            // Verify the Google token
            const ticket = await this.googleClient.verifyIdToken({
                idToken: token,
                audience: googleClientId,
            });
            const payload = ticket.getPayload();
            if (!payload) {
                res.status(400).json({ error: 'Invalid Google token' });
                return;
            }
            const { email, name, picture, email_verified } = payload;
            if (!email_verified) {
                res.status(400).json({ error: 'Google email not verified' });
                return;
            }
            // Check if user exists
            let user = await db_1.prisma.user.findUnique({
                where: { email },
            });
            if (!user) {
                // Create new user
                user = await db_1.prisma.user.create({
                    data: {
                        email,
                        name,
                        password: '', // No password for OAuth users
                        isVerified: true, // Google users are pre-verified
                        role: 'USER',
                    },
                });
                console.log(`New Google user created: ${email}`);
            }
            else {
                // Update user info if needed
                await db_1.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        name,
                        isVerified: true,
                    },
                });
            }
            // Generate tokens
            const accessToken = (0, auth_1.generateAccessToken)({
                id: user.id,
                email: user.email,
                role: user.role,
            });
            const refreshToken = (0, auth_1.generateRefreshToken)({ id: user.id });
            // Store refresh token
            await db_1.prisma.refreshToken.create({
                data: {
                    token: refreshToken,
                    userId: user.id,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                },
            });
            const response = (0, response_1.formatResponse)({
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isVerified: user.isVerified,
                },
                tokens: {
                    accessToken,
                    refreshToken,
                },
            }, 'Google authentication successful');
            res.json(response);
        }
        catch (error) {
            console.error('Google OAuth error:', error);
            if (error instanceof Error &&
                error.message.includes('Token used too late')) {
                res.status(400).json({ error: 'Google token expired' });
                return;
            }
            res.status(500).json({ error: 'Authentication failed' });
        }
    }
    async googleCallback(req, res) {
        try {
            const { code } = req.query;
            if (!code) {
                res.status(400).json({ error: 'Authorization code is required' });
                return;
            }
            const googleClientId = process.env.GOOGLE_CLIENT_ID;
            if (!googleClientId) {
                res.status(500).json({ error: 'Google authentication not configured' });
                return;
            }
            // Exchange code for tokens
            const { tokens } = await this.googleClient.getToken(code);
            if (!tokens.id_token) {
                res.status(400).json({ error: 'No ID token received' });
                return;
            }
            // Verify the ID token
            const ticket = await this.googleClient.verifyIdToken({
                idToken: tokens.id_token,
                audience: googleClientId,
            });
            const payload = ticket.getPayload();
            if (!payload) {
                res.status(400).json({ error: 'Invalid token payload' });
                return;
            }
            // Process the user (same logic as googleAuth)
            const { email, name, email_verified } = payload;
            if (!email_verified) {
                res.status(400).json({ error: 'Email not verified' });
                return;
            }
            let user = await db_1.prisma.user.findUnique({
                where: { email },
            });
            if (!user) {
                user = await db_1.prisma.user.create({
                    data: {
                        email,
                        name,
                        password: '',
                        isVerified: true,
                        role: 'USER',
                    },
                });
            }
            // Generate tokens
            const accessToken = (0, auth_1.generateAccessToken)({
                id: user.id,
                email: user.email,
                role: user.role,
            });
            const refreshToken = (0, auth_1.generateRefreshToken)({ id: user.id });
            await db_1.prisma.refreshToken.create({
                data: {
                    token: refreshToken,
                    userId: user.id,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });
            // Redirect to frontend with tokens (for web flow)
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            const redirectUrl = `${frontendUrl}/auth/success?token=${accessToken}&refresh=${refreshToken}`;
            res.redirect(redirectUrl);
        }
        catch (error) {
            console.error('Google callback error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            res.redirect(`${frontendUrl}/auth/error?message=Authentication failed`);
        }
    }
}
exports.OAuthController = OAuthController;
exports.oauthController = new OAuthController();
