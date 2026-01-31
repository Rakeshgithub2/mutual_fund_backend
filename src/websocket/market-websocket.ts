/**
 * Market WebSocket Service
 * Real-time market indices updates via Socket.IO
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import MarketIndicesService from '../services/market-indices.service';
import MarketCalendarService from '../services/market-calendar.service';

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5001',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  io.on('connection', (socket: Socket) => {
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
    socket.on('market:subscribe', (symbols: string[]) => {
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
async function handleClientConnection(socket: Socket) {
  try {
    // Send market status
    const marketStatus = await MarketCalendarService.getMarketStatus();
    socket.emit('market:status', marketStatus);

    // Send latest indices data
    await sendMarketData(socket);

    // Auto-join market-indices room
    socket.join('market-indices');
  } catch (error) {
    console.error('[WebSocket] Error handling connection:', error);
    socket.emit('market:error', { message: 'Failed to fetch market data' });
  }
}

/**
 * Send market data to a specific socket
 */
async function sendMarketData(socket: Socket) {
  try {
    const indices = await MarketIndicesService.getAllIndices();
    socket.emit('market:indices', indices);
  } catch (error) {
    console.error('[WebSocket] Error sending market data:', error);
    socket.emit('market:error', { message: 'Failed to fetch indices' });
  }
}

/**
 * Broadcast market update to all connected clients
 */
export function emitMarketUpdate(indices: any[]) {
  if (!io) {
    console.warn('[WebSocket] Socket.IO not initialized');
    return;
  }

  // Broadcast to all clients in market-indices room
  io.to('market-indices').emit('market:update', {
    indices,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `[WebSocket] Broadcasted update to ${io.sockets.sockets.size} clients`
  );
}

/**
 * Broadcast market status change
 */
export async function emitMarketStatus() {
  if (!io) return;

  const marketStatus = await MarketCalendarService.getMarketStatus();
  io.to('market-indices').emit('market:status', marketStatus);
}

/**
 * Get connected clients count
 */
export function getConnectedClients(): number {
  return io?.sockets.sockets.size || 0;
}

/**
 * Close WebSocket server
 */
export function closeWebSocket() {
  if (io) {
    io.close();
    console.log('[WebSocket] Server closed');
  }
}

export default {
  initializeWebSocket,
  emitMarketUpdate,
  emitMarketStatus,
  getConnectedClients,
  closeWebSocket,
};
