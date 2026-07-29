import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../middleware/auth';

let io: SocketServer;

export const initSocketIO = (httpServer: HttpServer): void => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    path: '/socket.io',
  });

  // ── Authentication Middleware ─────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth['token'] || socket.handshake.headers['authorization']?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as JwtPayload;
    console.log(`[Socket.IO] User ${user.email} connected (${socket.id})`);

    // Join tenant room for broadcast
    socket.join(`tenant-${user.tenantId}`);

    // Join specific job room
    socket.on('job:subscribe', (jobId: string) => {
      socket.join(`job-${jobId}`);
    });

    socket.on('job:unsubscribe', (jobId: string) => {
      socket.leave(`job-${jobId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] User ${user.email} disconnected`);
    });
  });

  console.log('📡 Socket.IO initialized');
};

export const getIO = (): SocketServer => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

// ── Emit helpers ──────────────────────────────────────────
export const emitJobProgress = (jobId: string, data: {
  progression: number;
  lignesTraitees: number;
  totalLignes: number;
  etaSeconds?: number;
  statut: string;
}) => {
  getIO().to(`job-${jobId}`).emit('job:progress', { jobId, ...data, timestamp: new Date().toISOString() });
};

export const emitJobCompleted = (jobId: string, resultat: object) => {
  getIO().to(`job-${jobId}`).emit('job:completed', { jobId, resultat, timestamp: new Date().toISOString() });
};

export const emitJobFailed = (jobId: string, erreur: string) => {
  getIO().to(`job-${jobId}`).emit('job:failed', { jobId, erreur, timestamp: new Date().toISOString() });
};
