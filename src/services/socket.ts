// Socket.IO service for real-time watchlist updates
// This handles WebSocket connections with JWT authentication
import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface SocketUser {
  id: string;
  email: string;
  role: string;
}

interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
}

let io: Server | null = null;

export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
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
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('❌ Socket connection rejected: No token provided');
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as SocketUser;
      socket.user = decoded;
      console.log(`✅ Socket authenticated for user: ${decoded.email}`);
      next();
    } catch (error) {
      console.log('❌ Socket connection rejected: Invalid token');
      return next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
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
      console.log(
        `🔌 User disconnected: ${socket.user?.email} - Reason: ${reason}`
      );
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error for user ${userId}:`, error);
    });
  });

  console.log('✅ Socket.IO initialized successfully');
  return io;
};

// Emit watchlist update to a specific user
export const emitWatchlistUpdate = (userId: string, data: any) => {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized, cannot emit watchlist update');
    return;
  }

  const userRoom = `user:${userId}`;
  console.log(`📤 Emitting watchlist:updated to room: ${userRoom}`);
  io.to(userRoom).emit('watchlist:updated', data);
};

// Broadcast to all connected users (use sparingly)
export const broadcastUpdate = (event: string, data: any) => {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized, cannot broadcast');
    return;
  }

  console.log(`📢 Broadcasting ${event} to all users`);
  io.emit(event, data);
};

export const getIO = (): Server | null => {
  return io;
};
