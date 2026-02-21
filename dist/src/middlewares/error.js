"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    if (err.name === 'ValidationError') {
        res.status(400).json({
            error: 'Validation Error',
            details: err.message,
        });
        return;
    }
    if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
            error: 'Invalid token',
        });
        return;
    }
    if (err.name === 'TokenExpiredError') {
        res.status(401).json({
            error: 'Token expired',
        });
        return;
    }
    // Default error
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
};
exports.errorHandler = errorHandler;
