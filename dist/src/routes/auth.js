"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const googleAuth_1 = require("../controllers/googleAuth");
const router = (0, express_1.Router)();
router.post('/register', auth_1.register);
router.post('/login', auth_1.login);
router.post('/refresh', auth_1.refreshTokens);
// Google OAuth - Production-ready ID Token verification flow (POST)
router.post('/google', googleAuth_1.googleLogin);
exports.default = router;
