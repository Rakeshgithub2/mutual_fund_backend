"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const googleAuth_1 = require("../controllers/googleAuth");
const emailAuth_1 = require("../controllers/emailAuth");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes - Authentication
router.post('/register', emailAuth_1.emailRegister); // ✅ Production-ready Email/Password registration
router.post('/login', emailAuth_1.emailLogin); // ✅ Production-ready Email/Password login
router.post('/google', googleAuth_1.googleLogin); // ✅ Production-ready Google OAuth
router.post('/refresh', auth_controller_1.refreshToken); // Refresh access token
// Password reset routes (public)
router.post('/forgot-password', auth_controller_1.forgotPassword); // Request password reset OTP
router.post('/verify-otp', auth_controller_1.verifyOTP); // Verify OTP code
router.post('/reset-password', auth_controller_1.resetPassword); // Reset password with OTP
// Protected routes - User management
router.post('/logout', auth_middleware_1.authenticateToken, auth_controller_1.logout);
router.post('/logout-all', auth_middleware_1.authenticateToken, auth_controller_1.logoutAll);
router.get('/me', auth_middleware_1.authenticateToken, auth_controller_1.getCurrentUser);
router.patch('/profile', auth_middleware_1.authenticateToken, auth_controller_1.updateProfile);
router.delete('/account', auth_middleware_1.authenticateToken, auth_controller_1.deleteAccount);
exports.default = router;
