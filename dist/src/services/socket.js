"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.broadcastUpdate = exports.emitWatchlistUpdate = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
let io = null;
const initializeSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: [
                'http://localhost:5001',
                'http://localhost:3000',
                'http://localhost:3001',
                process.env.FRONTEND_URL || 'http://localhost:5001',
            ],
            credentials: true,
        },
    });
    // Authentication middleware for Socket.IO
    io.use((socket, next) => {
        const token = socket.handshake.auth.token ||
            socket.handshake.headers.authorization?.split(' ')[1];
        if (!token) {
            console.log('❌ Socket connection rejected: No token provided');
            return next(new Error('Authentication token required'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            socket.user = decoded;
            console.log(`✅ Socket authenticated for user: ${decoded.email}`);
            next();
        }
        catch (error) {
            console.log('❌ Socket connection rejected: Invalid token');
            return next(new Error('Invalid authentication token'));
        }
    });
    io.on('connection', (socket) => {
        const userId = socket.user?.id;
        if (!userId) {
            socket.disconnect();
            return;
        }
        console.log(`🔌 User connected: ${socket.user?.email} (${userId})`);
        // Join user-specific room for targeted updates
        const userRoom = `user:${userId}`;
        socket.join(userRoom);
        console.log(`✅ User ${userId} joined room: ${userRoom}`);
        // Handle client events (optional - for future use)
        socket.on('watchlist:refresh', () => {
            console.log(`🔄 Watchlist refresh requested by user: ${userId}`);
            // Could trigger a re-fetch or emit latest data here
        });
        socket.on('disconnect', (reason) => {
            console.log(`🔌 User disconnected: ${socket.user?.email} - Reason: ${reason}`);
        });
        socket.on('error', (error) => {
            console.error(`❌ Socket error for user ${userId}:`, error);
        });
    });
    console.log('✅ Socket.IO initialized successfully');
    return io;
};
exports.initializeSocket = initializeSocket;
// Emit watchlist update to a specific user
const emitWatchlistUpdate = (userId, data) => {
    if (!io) {
        console.warn('⚠️ Socket.IO not initialized, cannot emit watchlist update');
        return;
    }
    const userRoom = `user:${userId}`;
    console.log(`📤 Emitting watchlist:updated to room: ${userRoom}`);
    io.to(userRoom).emit('watchlist:updated', data);
};
exports.emitWatchlistUpdate = emitWatchlistUpdate;
// Broadcast to all connected users (use sparingly)
const broadcastUpdate = (event, data) => {
    if (!io) {
        console.warn('⚠️ Socket.IO not initialized, cannot broadcast');
        return;
    }
    console.log(`📢 Broadcasting ${event} to all users`);
    io.emit(event, data);
};
exports.broadcastUpdate = broadcastUpdate;
const getIO = () => {
    return io;
};
exports.getIO = getIO;
