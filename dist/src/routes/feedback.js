"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Feedback_model_1 = require("../models/Feedback.model");
const emailService_1 = require("../services/emailService");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const router = (0, express_1.Router)();
/**
 * Rate limiter for feedback submissions
 * Max 5 submissions per hour per IP
 */
const feedbackLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour
    message: {
        error: 'Too many feedback submissions. Please try again later.',
        retryAfter: '1 hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
/**
 * Sanitize input to prevent XSS
 */
function sanitizeInput(input) {
    return input
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
}
/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * POST /api/feedback
 * Submit new feedback and send email notification
 */
router.post('/', feedbackLimiter, async (req, res) => {
    try {
        const { feedbackType, rating, name, email, message, userId } = req.body;
        // Validate required fields
        if (!message || !message.trim()) {
            return res.status(400).json({
                error: 'Message is required',
                success: false,
            });
        }
        // Sanitize inputs
        const sanitizedMessage = sanitizeInput(message);
        const sanitizedName = name ? sanitizeInput(name) : 'Anonymous';
        // Validate email if provided
        if (email && !isValidEmail(email)) {
            return res.status(400).json({
                error: 'Invalid email format',
                success: false,
            });
        }
        // Validate feedback data with Zod
        const feedbackData = {
            feedbackType: feedbackType || 'general',
            rating: typeof rating === 'number' ? Math.min(Math.max(rating, 0), 5) : 0,
            name: sanitizedName,
            email: email || null,
            message: sanitizedMessage,
            userId: userId || null,
            status: 'pending',
        };
        try {
            Feedback_model_1.FeedbackSchema.parse(feedbackData);
        }
        catch (validationError) {
            if (validationError instanceof zod_1.z.ZodError) {
                return res.status(400).json({
                    error: 'Invalid feedback data',
                    details: validationError.errors,
                    success: false,
                });
            }
        }
        // Save feedback to database
        const savedFeedback = await Feedback_model_1.feedbackModel.create(feedbackData);
        // Log feedback
        console.log('\n' + '='.repeat(80));
        console.log('📬 NEW USER FEEDBACK RECEIVED');
        console.log('='.repeat(80));
        console.log(`ID: ${savedFeedback._id}`);
        console.log(`Type: ${feedbackData.feedbackType}`);
        console.log(`Rating: ${feedbackData.rating}/5`);
        console.log(`Name: ${feedbackData.name}`);
        console.log(`Email: ${feedbackData.email || 'Not provided'}`);
        console.log(`User ID: ${feedbackData.userId || 'Not logged in'}`);
        console.log(`\nMessage:\n${feedbackData.message}`);
        console.log('='.repeat(80) + '\n');
        // Send email notification (don't fail if email fails)
        try {
            const emailResult = await emailService_1.emailService.sendFeedbackNotification({
                feedbackType: feedbackData.feedbackType,
                rating: feedbackData.rating,
                name: feedbackData.name,
                email: feedbackData.email,
                message: feedbackData.message,
                userId: feedbackData.userId,
                timestamp: savedFeedback.createdAt,
            });
            if (!emailResult.success) {
                console.warn('⚠️  Failed to send feedback email notification:', emailResult.error);
            }
        }
        catch (emailError) {
            console.error('⚠️  Email notification error (feedback still saved):', emailError);
        }
        // Return success response
        return res.status(201).json({
            success: true,
            message: 'Feedback received successfully. Thank you for your input!',
            feedbackId: savedFeedback._id,
        });
    }
    catch (error) {
        console.error('Error submitting feedback:', error);
        return res.status(500).json({
            error: 'Failed to submit feedback. Please try again later.',
            success: false,
        });
    }
});
/**
 * GET /api/feedback
 * Get all feedback (paginated, with optional filters)
 * Optional query params: status, feedbackType, userId, limit, skip
 */
router.get('/', async (req, res) => {
    try {
        const { status, feedbackType, userId, limit = '50', skip = '0', } = req.query;
        // Parse and validate query parameters
        const options = {
            limit: Math.min(parseInt(limit) || 50, 100), // Max 100 items
            skip: parseInt(skip) || 0,
        };
        if (status &&
            ['pending', 'reviewed', 'resolved'].includes(status)) {
            options.status = status;
        }
        if (feedbackType &&
            ['bug', 'feature', 'general'].includes(feedbackType)) {
            options.feedbackType = feedbackType;
        }
        if (userId) {
            options.userId = userId;
        }
        // Fetch feedback from database
        const { feedback, total } = await Feedback_model_1.feedbackModel.findAll(options);
        return res.status(200).json({
            success: true,
            data: feedback,
            pagination: {
                total,
                limit: options.limit,
                skip: options.skip,
                hasMore: options.skip + feedback.length < total,
            },
        });
    }
    catch (error) {
        console.error('Error fetching feedback:', error);
        return res.status(500).json({
            error: 'Failed to fetch feedback',
            success: false,
        });
    }
});
/**
 * GET /api/feedback/stats/summary
 * Get feedback statistics and summary
 */
router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await Feedback_model_1.feedbackModel.getStatistics();
        return res.status(200).json({
            success: true,
            stats: {
                total: stats.total,
                byStatus: stats.byStatus,
                byType: stats.byType,
                averageRating: parseFloat(stats.averageRating.toFixed(2)),
            },
        });
    }
    catch (error) {
        console.error('Error fetching feedback statistics:', error);
        return res.status(500).json({
            error: 'Failed to fetch feedback statistics',
            success: false,
        });
    }
});
/**
 * GET /api/feedback/:id
 * Get specific feedback by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const feedback = await Feedback_model_1.feedbackModel.findById(id);
        if (!feedback) {
            return res.status(404).json({
                error: 'Feedback not found',
                success: false,
            });
        }
        return res.status(200).json({
            success: true,
            data: feedback,
        });
    }
    catch (error) {
        console.error('Error fetching feedback:', error);
        return res.status(500).json({
            error: 'Failed to fetch feedback',
            success: false,
        });
    }
});
/**
 * PATCH /api/feedback/:id/status
 * Update feedback status (admin only)
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // Validate status
        if (!status || !['pending', 'reviewed', 'resolved'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status. Must be: pending, reviewed, or resolved',
                success: false,
            });
        }
        // Check if feedback exists
        const feedback = await Feedback_model_1.feedbackModel.findById(id);
        if (!feedback) {
            return res.status(404).json({
                error: 'Feedback not found',
                success: false,
            });
        }
        // Update status
        const updated = await Feedback_model_1.feedbackModel.updateStatus(id, status);
        if (!updated) {
            return res.status(500).json({
                error: 'Failed to update feedback status',
                success: false,
            });
        }
        console.log(`✓ Feedback ${id} status updated to: ${status}`);
        return res.status(200).json({
            success: true,
            message: 'Feedback status updated successfully',
            status,
        });
    }
    catch (error) {
        console.error('Error updating feedback status:', error);
        return res.status(500).json({
            error: 'Failed to update feedback status',
            success: false,
        });
    }
});
/**
 * DELETE /api/feedback/:id
 * Delete feedback by ID (admin only)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Feedback_model_1.feedbackModel.delete(id);
        if (!deleted) {
            return res.status(404).json({
                error: 'Feedback not found',
                success: false,
            });
        }
        console.log(`✓ Feedback ${id} deleted`);
        return res.status(200).json({
            success: true,
            message: 'Feedback deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting feedback:', error);
        return res.status(500).json({
            error: 'Failed to delete feedback',
            success: false,
        });
    }
});
exports.default = router;
