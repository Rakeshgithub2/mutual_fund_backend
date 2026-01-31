import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  getKYCStatus,
  submitKYC,
  updateKYCStatus,
  getAllKYC,
  deleteKYC,
} from '../controllers/kyc';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user's KYC status
router.get('/status', getKYCStatus);

// Submit KYC application
router.post('/submit', submitKYC);

// Admin routes
router.get('/all', getAllKYC); // Get all KYC applications (admin only)
router.put('/:userId/status', updateKYCStatus); // Update KYC status (admin only)
router.delete('/:userId', deleteKYC); // Delete KYC (admin only)

export default router;
