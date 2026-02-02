"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const kyc_1 = require("../controllers/kyc");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Get user's KYC status
router.get('/status', kyc_1.getKYCStatus);
// Submit KYC application
router.post('/submit', kyc_1.submitKYC);
// Admin routes
router.get('/all', kyc_1.getAllKYC); // Get all KYC applications (admin only)
router.put('/:userId/status', kyc_1.updateKYCStatus); // Update KYC status (admin only)
router.delete('/:userId', kyc_1.deleteKYC); // Delete KYC (admin only)
exports.default = router;
