"use strict";
/**
 * Market WebSocket Service
 * Real-time market indices updates via Socket.IO
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeWebSocket = initializeWebSocket;
exports.emitMarketUpdate = emitMarketUpdate;
exports.emitMarketStatus = emitMarketStatus;
exports.getConnectedClients = getConnectedClients;
exports.closeWebSocket = closeWebSocket;
const socket_io_1 = require("socket.io");
const market_indices_service_1 = __importDefault(require("../services/market-indices.service"));
const market_calendar_service_1 = __importDefault(require("../services/market-calendar.service"));
let io = null;
/**
 * Initialize WebSocket server
 */
function initializeWebSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5001',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        path: '/socket.io',
    });
    io.on('connection', (socket) => {
        console.log(`[WebSocket] Client connected: ${socket.id}`);
        // Send current market status on connection
        handleClientConnection(socket);
        // Handle client disconnect
        socket.on('disconnect', () => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        });
        // Handle manual refresh request
        socket.on('market:refresh', async () => {
            await sendMarketData(socket);
        });
        // Subscribe to specific indices
        socket.on('market:subscribe', (symbols) => {
            console.log(`[WebSocket] Client subscribed to:`, symbols);
            socket.join('market-indices');
        });
    });
    console.log('✅ WebSocket server initialized');
    return io;
}
/**
 * Handle new client connection
 */
async function handleClientConnection(socket) {
    try {
        // Send market status
        const marketStatus = await market_calendar_service_1.default.getMarketStatus();
        socket.emit('market:status', marketStatus);
        // Send latest indices data
        await sendMarketData(socket);
        // Auto-join market-indices room
        socket.join('market-indices');
    }
    catch (error) {
        console.error('[WebSocket] Error handling connection:', error);
        socket.emit('market:error', { message: 'Failed to fetch market data' });
    }
}
/**
 * Send market data to a specific socket
 */
async function sendMarketData(socket) {
    try {
        const indices = await market_indices_service_1.default.getAllIndices();
        socket.emit('market:indices', indices);
    }
    catch (error) {
        console.error('[WebSocket] Error sending market data:', error);
        socket.emit('market:error', { message: 'Failed to fetch indices' });
    }
}
/**
 * Broadcast market update to all connected clients
 */
function emitMarketUpdate(indices) {
    if (!io) {
        console.warn('[WebSocket] Socket.IO not initialized');
        return;
    }
    // Broadcast to all clients in market-indices room
    io.to('market-indices').emit('market:update', {
        indices,
        timestamp: new Date().toISOString(),
    });
    console.log(`[WebSocket] Broadcasted update to ${io.sockets.sockets.size} clients`);
}
/**
 * Broadcast market status change
 */
async function emitMarketStatus() {
    if (!io)
        return;
    const marketStatus = await market_calendar_service_1.default.getMarketStatus();
    io.to('market-indices').emit('market:status', marketStatus);
}
/**
 * Get connected clients count
 */
function getConnectedClients() {
    return io?.sockets.sockets.size || 0;
}
/**
 * Close WebSocket server
 */
function closeWebSocket() {
    if (io) {
        io.close();
        console.log('[WebSocket] Server closed');
    }
}
exports.default = {
    initializeWebSocket,
    emitMarketUpdate,
    emitMarketStatus,
    getConnectedClients,
    closeWebSocket,
};
